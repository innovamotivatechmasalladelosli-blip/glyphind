import type { GlyphindSource } from '../domain/model';
import { selectEnsembleSentences, selectSemanticSentences, splitSummarySentences } from '../domain/semantic-summary';

export type LocalAnalysisMode = 'rules' | 'model';
export type AnalysisEvidence = Pick<GlyphindSource, 'kind' | 'title' | 'url' | 'fragment' | 'selector' | 'generatedBy' | 'confidence'> & { text: string };
export type LocalAnalysisResult = {
  title: string;
  summary: string;
  keySentences: string[];
  sections: string[];
  paragraphs: string[];
  keywords: string[];
  evidence: AnalysisEvidence[];
  modelUsed: boolean;
  modelId?: string;
  modelError?: string;
};

type AnalyzeRequest = { id: number; action: 'analyze'; raw: string; sourceUrl?: string; mode: LocalAnalysisMode };
export type LocalAnalysisProgress = { stage: 'starting' | 'fetching' | 'downloading' | 'loading' | 'generating'; file?: string; progress?: number };
type AnalyzeResponse = { id: number; ok: true; result: LocalAnalysisResult } | { id: number; ok: false; error: string } | { id: number; ok: true; progress: LocalAnalysisProgress };

const stopWords = new Set('para con las los una uno que del por sus más como este esta desde entre sobre donde cuando cómo qué son esto esta esta también pero porque desde hasta sobre entre hacia cada puede pueden sido muy sin contra'.split(' '));
const stripMarkup = (value: string) => value
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim();

function snippets(raw: string, tag: string) {
  const matcher = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  return [...raw.matchAll(matcher)].map((match) => stripMarkup(match[1])).filter(Boolean);
}

function plainTextParagraphs(raw: string) {
  const lines = raw.replace(/\r/g, '').split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/).map((line) => stripMarkup(line)).filter((line) => line.length > 30);
  return lines.slice(0, 16);
}

function keyTerms(text: string) {
  const words = text.toLocaleLowerCase('es-MX').match(/[a-záéíóúñü]{4,}/gi) ?? [];
  const frequencies = new Map<string, number>();
  for (const word of words) {
    if (!stopWords.has(word)) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  }
  return [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word]) => word);
}

function buildResult(raw: string, sourceUrl?: string): LocalAnalysisResult {
  const textTitle = plainTextParagraphs(raw)[0]?.split(/[.!?:;]/)[0]?.trim().split(/\s+/).slice(0, 8).join(' ');
  const title = snippets(raw, 'title')[0] || snippets(raw, 'h1')[0] || textTitle || 'Información extraída';
  const sections = [...snippets(raw, 'h1'), ...snippets(raw, 'h2'), ...snippets(raw, 'h3')].filter((section, index, all) => section !== title && all.indexOf(section) === index).slice(0, 8);
  const paragraphs = [...snippets(raw, 'p'), ...snippets(raw, 'li')].filter((paragraph) => paragraph.length > 30).slice(0, 16);
  const usableParagraphs = paragraphs.length ? paragraphs : plainTextParagraphs(raw);
  const text = usableParagraphs.length ? usableParagraphs.join(' ') : stripMarkup(raw);
  const keywords = keyTerms(text);
  const evidence: AnalysisEvidence[] = usableParagraphs.slice(0, 8).map((paragraph, index) => ({
    kind: sourceUrl ? 'url' : /<[^>]+>/.test(raw) ? 'html' : 'text',
    title: sections[index] || title,
    ...(sourceUrl ? { url: sourceUrl } : {}),
    fragment: paragraph.slice(0, 280),
    selector: sections[index] ? `h${Math.min(3, index + 1)}` : 'p',
    text: paragraph,
    generatedBy: 'rules',
    confidence: sections[index] ? 0.96 : 0.86,
  }));
  return {
    title,
    summary: text.slice(0, 520),
    keySentences: splitSummarySentences(text).slice(0, 8),
    sections,
    paragraphs: usableParagraphs,
    keywords,
    evidence,
    modelUsed: false,
  };
}

type EmbeddingTensor = { data: ArrayLike<number>; dims: number[] };
type EmbeddingGenerator = (inputs: string[], options?: Record<string, unknown>) => Promise<EmbeddingTensor>;
const generators: Partial<Record<'relevance' | 'diversity', EmbeddingGenerator>> = {};
const MODEL_IDS = { relevance: 'Xenova/multilingual-e5-small', diversity: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2' } as const;

function reportProgress(id: number, progress: LocalAnalysisProgress) {
  self.postMessage({ id, ok: true, progress } satisfies AnalyzeResponse);
}

async function loadModel(kind: 'relevance' | 'diversity', requestId: number) {
  if (!generators[kind]) {
    reportProgress(requestId, { stage: 'downloading', file: MODEL_IDS[kind] });
    const transformers = await import('@huggingface/transformers');
    transformers.env.useBrowserCache = true;
    transformers.env.allowLocalModels = false;
    generators[kind] = await transformers.pipeline('feature-extraction', MODEL_IDS[kind], {
      dtype: 'q8',
      progress_callback: (event: { status?: string; file?: string; progress?: number }) => {
        const stage = event.status === 'progress' || event.status === 'download' ? 'downloading' : 'loading';
        reportProgress(requestId, { stage, ...(event.file ? { file: event.file.split('/').pop() } : {}), ...(typeof event.progress === 'number' ? { progress: event.progress } : {}) });
      },
    }) as unknown as EmbeddingGenerator;
  }
  const currentGenerator = generators[kind];
  if (!currentGenerator) throw new Error(`El modelo local ${MODEL_IDS[kind]} no está disponible.`);
  return currentGenerator;
}

function vectorsFrom(output: EmbeddingTensor, rows: number, width: number) {
  if (!width || output.data.length < rows * width) throw new Error('Uno de los modelos locales devolvió embeddings incompletos.');
  return Array.from({ length: rows }, (_, row) => Array.from({ length: width }, (_, column) => Number(output.data[row * width + column])));
}

async function selectWithLocalModel(queryText: string, text: string, requestId: number) {
  const relevanceGenerator = await loadModel('relevance', requestId);
  const sentences = splitSummarySentences(text);
  if (!sentences.length) throw new Error('No hay frases suficientemente largas para clasificar semánticamente.');
  reportProgress(requestId, { stage: 'generating', file: 'ensamble: relevancia + diversidad' });
  const relevanceInputs = [`query: ${queryText.slice(0, 1800)}`, ...sentences.map((sentence) => `passage: ${sentence}`)];
  const relevanceOutput = await relevanceGenerator(relevanceInputs, { pooling: 'mean', normalize: true });
  const [rows, width] = relevanceOutput.dims;
  if (rows !== relevanceInputs.length) throw new Error('El modelo de relevancia devolvió filas incompletas.');
  const relevanceVectors = vectorsFrom(relevanceOutput, rows, width);
  const query = relevanceVectors[0];
  const scores = relevanceVectors.slice(1).map((vector) => {
    const dot = vector.reduce((sum, value, index) => sum + value * query[index], 0);
    const normA = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    const normB = Math.sqrt(query.reduce((sum, value) => sum + value * value, 0));
    return normA && normB ? dot / (normA * normB) : Number.NaN;
  });
  try {
    const diversityGenerator = await loadModel('diversity', requestId);
    const diversityOutput = await diversityGenerator(sentences, { pooling: 'mean', normalize: true });
    const [diversityRows, diversityWidth] = diversityOutput.dims;
    if (diversityRows !== sentences.length) throw new Error('El modelo de diversidad devolvió filas incompletas.');
    const diversityVectors = vectorsFrom(diversityOutput, diversityRows, diversityWidth);
    const selected = selectEnsembleSentences(sentences, scores, diversityVectors, 6);
    if (!selected.length) throw new Error('El ensamble no pudo seleccionar frases sustentadas.');
    return { selected, modelId: `${MODEL_IDS.relevance} + ${MODEL_IDS.diversity}` };
  } catch (error) {
    const selected = selectSemanticSentences(sentences, scores, 6);
    if (!selected.length) throw error;
    return { selected, modelId: MODEL_IDS.relevance, modelError: error instanceof Error ? error.message : 'El segundo modelo no pudo cargar.' };
  }
}

self.onmessage = async (event: MessageEvent<AnalyzeRequest>) => {
  const request = event.data;
  if (request.action !== 'analyze') return;
  try {
      const result = buildResult(request.raw, request.sourceUrl);
      if (request.mode === 'model') {
        try {
          const sourceText = result.paragraphs.join(' ') || result.summary;
          const modelResult = await selectWithLocalModel(`${result.title}. ${result.summary}`, sourceText, request.id);
          result.keySentences = modelResult.selected;
          result.summary = result.keySentences.slice(0, 2).join(' ');
        result.modelUsed = true;
        result.modelId = modelResult.modelId;
        result.modelError = modelResult.modelError;
      } catch (error) {
        result.modelUsed = false;
        result.modelError = error instanceof Error ? error.message : 'No se pudo descargar o ejecutar el modelo compacto.';
      }
    }
    const response: AnalyzeResponse = { id: request.id, ok: true, result };
    self.postMessage(response);
  } catch (error) {
    const response: AnalyzeResponse = { id: request.id, ok: false, error: error instanceof Error ? error.message : 'No se pudo analizar el contenido local.' };
    self.postMessage(response);
  }
};
