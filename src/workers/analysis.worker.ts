import type { GlyphindSource } from '../domain/model';
import { selectSemanticSentences, splitSummarySentences } from '../domain/semantic-summary';

export type LocalAnalysisMode = 'rules' | 'model';
export type AnalysisEvidence = Pick<GlyphindSource, 'kind' | 'title' | 'url' | 'fragment' | 'selector' | 'generatedBy' | 'confidence'> & { text: string };
export type LocalAnalysisResult = {
  title: string;
  summary: string;
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
  const title = snippets(raw, 'title')[0] || snippets(raw, 'h1')[0] || 'Información extraída';
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
    sections,
    paragraphs: usableParagraphs,
    keywords,
    evidence,
    modelUsed: false,
  };
}

type EmbeddingTensor = { data: ArrayLike<number>; dims: number[] };
type EmbeddingGenerator = (inputs: string[], options?: Record<string, unknown>) => Promise<EmbeddingTensor>;
let generator: EmbeddingGenerator | null = null;
const MODEL_ID = 'Xenova/multilingual-e5-small';

function reportProgress(id: number, progress: LocalAnalysisProgress) {
  self.postMessage({ id, ok: true, progress } satisfies AnalyzeResponse);
}

async function selectWithLocalModel(text: string, requestId: number) {
  if (!generator) {
    reportProgress(requestId, { stage: 'downloading' });
    const transformers = await import('@huggingface/transformers');
    transformers.env.useBrowserCache = true;
    transformers.env.allowLocalModels = false;
    generator = await transformers.pipeline('feature-extraction', MODEL_ID, {
      dtype: 'q8',
      progress_callback: (event: { status?: string; file?: string; progress?: number }) => {
        const stage = event.status === 'progress' || event.status === 'download' ? 'downloading' : 'loading';
        reportProgress(requestId, { stage, ...(event.file ? { file: event.file.split('/').pop() } : {}), ...(typeof event.progress === 'number' ? { progress: event.progress } : {}) });
      },
    }) as unknown as EmbeddingGenerator;
  }
  const currentGenerator = generator;
  if (!currentGenerator) throw new Error('El generador local no está disponible.');
  const sentences = splitSummarySentences(text);
  if (!sentences.length) throw new Error('No hay frases suficientemente largas para clasificar semánticamente.');
  reportProgress(requestId, { stage: 'generating' });
  const inputs = [`query: ${text.slice(0, 1800)}`, ...sentences.map((sentence) => `passage: ${sentence}`)];
  const output = await currentGenerator(inputs, { pooling: 'mean', normalize: true });
  const [rows, width] = output.dims;
  if (rows !== inputs.length || !width || output.data.length < rows * width) throw new Error('El modelo local devolvió embeddings incompletos.');
  const vectors = Array.from({ length: rows }, (_, row) => Array.from({ length: width }, (_, column) => Number(output.data[row * width + column])));
  const query = vectors[0];
  const scores = vectors.slice(1).map((vector) => {
    const dot = vector.reduce((sum, value, index) => sum + value * query[index], 0);
    const normA = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    const normB = Math.sqrt(query.reduce((sum, value) => sum + value * value, 0));
    return normA && normB ? dot / (normA * normB) : Number.NaN;
  });
  const selected = selectSemanticSentences(sentences, scores, 2);
  if (!selected.length) throw new Error('No se pudo puntuar ninguna frase de la fuente. Se conserva la extracción local.');
  return selected.join(' ');
}

self.onmessage = async (event: MessageEvent<AnalyzeRequest>) => {
  const request = event.data;
  if (request.action !== 'analyze') return;
  try {
    const result = buildResult(request.raw, request.sourceUrl);
    if (request.mode === 'model') {
      try {
        const sourceText = `${result.title}. ${result.paragraphs.slice(0, 4).join(' ') || result.summary}`;
        result.summary = await selectWithLocalModel(sourceText, request.id);
        result.modelUsed = true;
        result.modelId = MODEL_ID;
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
