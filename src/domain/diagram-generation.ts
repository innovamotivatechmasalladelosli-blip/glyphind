import type { LocalAnalysisResult } from '../workers/analysis.worker';
import { createEdgesFromNodes, type DiagramNode, type GlyphindSource, type Project } from './model';
import { createLocalId } from './ids';
import { splitSummarySentences } from './semantic-summary';

function extractedFacts(analysis: LocalAnalysisResult): string[] {
  const candidates = analysis.keySentences?.length
    ? analysis.keySentences
    : analysis.paragraphs.flatMap((paragraph) => splitSummarySentences(paragraph));
  const titleKey = (analysis.title || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es-MX');
  const seen = new Set<string>();
  const unique = candidates
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => value.length >= 20)
    .filter((value) => {
      const key = value.toLocaleLowerCase('es-MX');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const withoutRepeatedTitle = titleKey.length >= 24 ? unique.filter((value) => !value.toLocaleLowerCase('es-MX').startsWith(titleKey)) : unique;
  return (withoutRepeatedTitle.length ? withoutRepeatedTitle : unique).slice(0, 8);
}

function labelFromSentence(sentence: string): string {
  const clean = sentence.replace(/^[-•\d.)\s]+/, '').replace(/[.!?]+$/, '').trim();
  const words = clean.split(/\s+/);
  const label = words.slice(0, 7).join(' ');
  return `${label.length > 58 ? `${label.slice(0, 55).trimEnd()}…` : label}${words.length > 7 && label.length <= 58 ? '…' : ''}`;
}

export function populateProjectFromAnalysis(project: Project, analysis: LocalAnalysisResult, sourceUrl?: string): Project {
  const facts = extractedFacts(analysis);
  if (!facts.length) throw new Error('No encontré frases completas para crear tarjetas. Prueba con un texto más largo o con párrafos separados.');

  const stamp = new Date().toISOString();
  const generator = analysis.modelUsed ? 'local-model' as const : 'rules' as const;
  const central = project.type === 'mindmap' || project.type === 'concept';
  const rootId = createLocalId('node');
  const rootTitle = analysis.title || project.name;
  const rootWords = rootTitle.split(/\s+/);
  const rootLabel = `${rootWords.slice(0, 5).join(' ')}${rootWords.length > 5 ? '…' : ''}`.slice(0, 42);
  const root: DiagramNode = {
    id: rootId,
    label: rootLabel,
    detail: analysis.summary || 'Tema central extraído de la fuente.',
    content: analysis.summary || '',
    x: central ? 50 : 8,
    y: 50,
    tone: 'dark',
    shape: central ? (project.type === 'mindmap' ? 'circle' : 'hexagon') : 'pill',
    inference: generator,
    evidenceId: createLocalId('evidence'),
  };

  const children = facts.map((fact, index): DiagramNode => {
    const angle = -Math.PI / 2 + (index / Math.max(1, facts.length)) * Math.PI * 2;
    const isSequential = !central;
    const node: DiagramNode = {
      id: createLocalId('node'),
      label: labelFromSentence(fact),
      detail: fact,
      content: fact,
      x: central ? 50 + Math.cos(angle) * 34 : 24 + (index / Math.max(1, facts.length - 1)) * 66,
      y: central ? 50 + Math.sin(angle) * 34 : (index % 2 === 0 ? 34 : 66),
      tone: ['blue', 'lilac', 'green', 'orange', 'rose', 'yellow'][index % 6],
      shape: project.type === 'mindmap' ? 'pill' : 'card',
      inference: generator,
      evidenceId: createLocalId('evidence'),
    };
    if (isSequential) node.x = 24 + (index / Math.max(1, facts.length - 1)) * 66;
    return node;
  });
  const nodes = [root, ...children];
  const edges = createEdgesFromNodes(project.type, nodes).map((edge) => ({ ...edge, label: '', relation: '' }));
  const sources: GlyphindSource[] = [
    {
      id: createLocalId('source'),
      kind: sourceUrl ? 'url' : 'text',
      ...(sourceUrl ? { url: sourceUrl } : {}),
      title: analysis.title || project.name,
      capturedAt: stamp,
      fragment: (analysis.summary || '').slice(0, 280),
      nodeIds: [root.id],
      generatedBy: generator,
    },
    ...children.map((node, index) => ({
      id: createLocalId('source'),
      kind: sourceUrl ? 'url' as const : 'text' as const,
      ...(sourceUrl ? { url: sourceUrl } : {}),
      title: `Hallazgo ${index + 1}`,
      capturedAt: stamp,
      fragment: facts[index].slice(0, 280),
      nodeIds: [node.id],
      generatedBy: generator,
    })),
  ];
  nodes.forEach((node, index) => {
    node.evidenceId = sources[index]?.id;
  });
  return {
    ...project,
    updated: Date.now(),
    nodes,
    edges,
    groups: [],
    sources,
    pages: [{ id: createLocalId('page'), title: 'Ideas extraídas', nodeIds: nodes.map((node) => node.id), edgeIds: edges.map((edge) => edge.id) }],
  };
}
