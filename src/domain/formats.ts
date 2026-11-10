import type { DiagramNode, EdgeDirection, EdgePort, GlyphindEdge, Project } from './model';

export type FormatPlugin = {
  id: string;
  name: string;
  extensions: string[];
  kind: 'importer' | 'exporter';
  enabled: boolean;
};

const PLUGIN_REGISTRY_KEY = 'glyphind-format-plugins-v1';
const MAX_PLUGIN_DESCRIPTORS = 100;
const MAX_PLUGIN_REGISTRY_BYTES = 100_000;
const normalizePlugin = (item: unknown): FormatPlugin | null => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const plugin = item as Partial<FormatPlugin>;
  if (typeof plugin.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(plugin.id) || typeof plugin.name !== 'string' || !plugin.name.trim() || plugin.name.length > 160 || !Array.isArray(plugin.extensions) || plugin.extensions.length < 1 || plugin.extensions.length > 10 || !plugin.extensions.every((extension) => typeof extension === 'string' && /^[a-z0-9]{1,12}$/i.test(extension)) || (plugin.kind !== 'importer' && plugin.kind !== 'exporter')) return null;
  const extensions = [...new Set(plugin.extensions.map((extension) => extension.toLowerCase()))];
  if (extensions.length !== plugin.extensions.length) return null;
  return { id: plugin.id, name: plugin.name.trim().slice(0, 80), extensions, kind: plugin.kind, enabled: false };
};

/** Portable metadata only. This registry never loads or evaluates imported scripts. */
export function readFormatPlugins(storage: Pick<Storage, 'getItem'> = localStorage): FormatPlugin[] {
  try {
    const raw = storage.getItem(PLUGIN_REGISTRY_KEY) || '[]';
    if (raw.length > MAX_PLUGIN_REGISTRY_BYTES) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const result: FormatPlugin[] = [];
    const ids = new Set<string>();
    for (const entry of parsed.slice(0, MAX_PLUGIN_DESCRIPTORS)) {
      const plugin = normalizePlugin(entry);
      if (!plugin || ids.has(plugin.id)) continue;
      ids.add(plugin.id);
      result.push(plugin);
    }
    return result;
  } catch { return []; }
}

export function writeFormatPlugins(plugins: FormatPlugin[], storage: Pick<Storage, 'setItem'> = localStorage): void {
  const result: FormatPlugin[] = [];
  const ids = new Set<string>();
  for (const item of plugins.slice(0, MAX_PLUGIN_DESCRIPTORS)) {
    const plugin = normalizePlugin(item);
    if (!plugin || ids.has(plugin.id)) continue;
    ids.add(plugin.id);
    result.push(plugin);
  }
  const serialized = JSON.stringify(result);
  if (serialized.length > MAX_PLUGIN_REGISTRY_BYTES) throw new RangeError('El catálogo de descriptores excede el límite local permitido.');
  storage.setItem(PLUGIN_REGISTRY_KEY, serialized);
}

const slug = (value: string, fallback: string) => {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_]/g, '_').replace(/^\d/, '_$&');
  return normalized || fallback;
};

function plainLabel(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:amp|#38);/gi, '&')
    .replace(/&(?:lt|#60);/gi, '<')
    .replace(/&(?:gt|#62);/gi, '>')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNodeToken(token: string): { id: string; label: string } | null {
  const source = token.trim();
  const match = source.match(/^([\w.-]+)\s*(?:\(\[([\s\S]*?)\]\)|\(\(([^)]*?)\)\)|\[\[([\s\S]*?)\]\]|\[([\s\S]*?)\]|\(([^)]*)\)|\{([^}]*)\})?$/);
  if (!match) return null;
  const id = match[1];
  const label = plainLabel(match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6] ?? match[7] ?? id);
  return { id, label: label || id };
}

/** Imports the safe, common flowchart subset of Mermaid without evaluating directives or HTML. */
export function importMermaid(source: string, name = 'Diagrama Mermaid'): Project {
  if (source.length > 2_000_000) throw new Error('El archivo Mermaid supera el límite de 2 MB.');
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  const first = lines.find((line) => line.trim() && !line.trim().startsWith('%%'))?.trim() ?? '';
  const header = first.match(/^(?:flowchart|graph)\s+(TB|TD|BT|RL|LR)\b/i);
  if (!header) throw new Error('El archivo no contiene un encabezado flowchart/graph Mermaid compatible.');

  const nodeMap = new Map<string, { id: string; label: string }>();
  const edgeRows: Array<{ from: string; to: string; label?: string; direction: EdgeDirection }> = [];
  const unsupported: string[] = [];
  const register = (id: string, label: string) => {
    if (!nodeMap.has(id)) nodeMap.set(id, { id, label });
  };

  for (const rawLine of lines.slice(lines.indexOf(lines.find((line) => line.trim() === first) ?? first) + 1)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%') || /^(?:classDef|class|style|linkStyle|direction|subgraph|end\b)/i.test(line)) continue;
    if (/^(?:click|href|javascript:|init\b|%%\{)/i.test(line)) {
      unsupported.push(line);
      continue;
    }
    const normalizedLine = line.replace(/(-->|==>)\s*\|([^|]*)\|/g, (_match, arrow: string, label: string) => arrow.startsWith('--') ? `--|${label}|-->` : `==|${label}|==>`);
    const edgePattern = /([\w.-]+\s*(?:\(\[[\s\S]*?\]\)|\(\([^)]*?\)\)|\[\[[\s\S]*?\]\]|\[[\s\S]*?\]|\([^)]*\)|\{[^}]*\})?)\s*(<-->|<--|-->|---|==>|-.->|--\s*\|([^|]*)\|\s*-->|==\s*\|([^|]*)\|\s*==>|-\.\s*([^.]*)\s*\.->)\s*([\w.-]+\s*(?:\(\[[\s\S]*?\]\)|\(\([^)]*?\)\)|\[\[[\s\S]*?\]\]|\[[\s\S]*?\]|\([^)]*\)|\{[^}]*\})?)/g;
    let matched = false;
    let cursor = 0;
    for (const match of normalizedLine.matchAll(edgePattern)) {
      matched = true;
      const before = line.slice(cursor, match.index ?? 0).trim();
      if (before) unsupported.push(before);
      cursor = (match.index ?? 0) + match[0].length;
      const left = parseNodeToken(match[1]);
      const right = parseNodeToken(match[6]);
      if (!left || !right) { unsupported.push(match[0]); continue; }
      register(left.id, left.label);
      register(right.id, right.label);
      const arrow = match[2];
      edgeRows.push({
        from: left.id,
        to: right.id,
        ...(match[3] || match[4] || match[5] ? { label: plainLabel(match[3] ?? match[4] ?? match[5]) } : {}),
        direction: arrow === '<--' ? 'backward' : arrow === '<-->' ? 'both' : arrow.includes('>') ? 'forward' : 'none',
      });
    }
    const remainder = normalizedLine.slice(cursor).trim();
    if (matched) {
      if (remainder) unsupported.push(remainder);
      continue;
    }
    const standalone = parseNodeToken(line);
    if (standalone) register(standalone.id, standalone.label);
    else unsupported.push(line);
  }

  if (unsupported.length) throw new Error(`No se importó el archivo: contiene sintaxis Mermaid no compatible o directivas activas (${unsupported.slice(0, 2).join('; ')}).`);
  if (!nodeMap.size) throw new Error('El archivo Mermaid no contiene nodos compatibles.');

  const entries = [...nodeMap.values()];
  const columns = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
  const nodes: DiagramNode[] = entries.map((entry, index) => ({
    id: `mermaid-${slug(entry.id, `node_${index + 1}`)}`,
    label: entry.label,
    detail: '',
    x: entries.length === 1 ? 50 : 12 + (index % columns) * (76 / Math.max(1, columns - 1)),
    y: entries.length === 1 ? 50 : 15 + Math.floor(index / columns) * (70 / Math.max(1, Math.ceil(entries.length / columns) - 1)),
    tone: ['blue', 'lilac', 'green', 'orange'][index % 4],
    inference: 'user',
  }));
  const ids = new Map(entries.map((entry, index) => [entry.id, nodes[index].id]));
  const edges: GlyphindEdge[] = edgeRows.map((edge, index) => ({
    id: `mermaid-edge-${index + 1}`,
    from: ids.get(edge.from)!,
    to: ids.get(edge.to)!,
    direction: edge.direction,
    ...(edge.label ? { label: edge.label, relation: edge.label } : {}),
  }));
  const id = `project-mermaid-${Date.now()}`;
  return {
    schemaVersion: 1,
    id,
    name,
    type: 'flow',
    updated: Date.now(),
    nodes,
    edges,
    groups: [],
    pages: [{ id: 'page-main', title: 'Página principal', nodeIds: nodes.map((node) => node.id), edgeIds: edges.map((edge) => edge.id) }],
    sources: [],
  };
}

function mermaidText(value: string): string {
  // Quoted labels are escaped to prevent accidental Mermaid syntax injection.
  return plainLabel(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sin título';
}

/** Exports Glyphind's explicit graph as a conservative Mermaid flowchart. */
export function exportMermaid(project: Project): string {
  const nodes = project.nodes;
  if (!nodes.length) return 'flowchart LR';
  const used = new Set<string>();
  const ids = new Map<string, string>();
  nodes.forEach((node, index) => {
    const base = slug(node.id, `node_${index + 1}`);
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}_${suffix++}`;
    used.add(id);
    ids.set(node.id, id);
  });
  const lines = ['flowchart LR'];
  for (const node of nodes) lines.push(`  ${ids.get(node.id)}["${mermaidText(node.label)}"]`);
  for (const edge of project.edges) {
    const from = ids.get(edge.from);
    const to = ids.get(edge.to);
    if (!from || !to || from === to) continue;
    const label = mermaidText(edge.label || edge.relation || '');
    const arrow = edge.direction === 'none' ? '---' : edge.direction === 'backward' ? '<--' : edge.direction === 'both' ? '<-->' : '-->';
    const directed = arrow === '<--' ? `${to} <--${label !== 'Sin título' ? `| ${label} |` : ''} ${from}` : `${from} ${arrow}${label !== 'Sin título' ? `| ${label} |` : ''} ${to}`;
    lines.push(`  ${directed}`.replace(/\s+/g, ' ').trim());
  }
  return `${lines.join('\n')}\n`;
}

export function importMarkdown(source: string, name = 'Documento Markdown'): Project {
  if (source.length > 2_000_000) throw new Error('El archivo Markdown supera el límite de 2 MB.');
  const content = source.replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/);
  const visibleLines: string[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) { if (!fence) fence = marker[1][0]; else if (marker[1][0] === fence) fence = null; continue; }
    if (!fence) visibleLines.push(line);
  }
  const heading = visibleLines.map((line) => line.match(/^#\s+(.+)$/)?.[1]?.trim()).find(Boolean);
  const candidates = visibleLines.flatMap((line) => {
    const match = line.match(/^\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)(.+)$/);
    return match ? [plainLabel(match[1])] : [];
  }).filter(Boolean);
  if (!candidates.length) throw new Error('El Markdown no contiene encabezados o elementos de lista importables fuera de bloques de código.');
  const labels = candidates.slice(0, 200);
  const nodes: DiagramNode[] = labels.map((label, index) => ({
    id: `markdown-${index + 1}`,
    label: label.slice(0, 240),
    detail: '',
    content: label,
    x: labels.length === 1 ? 50 : 12 + (index % 4) * 25,
    y: 18 + Math.floor(index / 4) * 18,
    tone: ['blue', 'lilac', 'green', 'orange'][index % 4],
    inference: 'user',
  }));
  const edges = nodes.slice(1).map((node, index) => ({ id: `markdown-edge-${index + 1}`, from: nodes[index].id, to: node.id, relation: 'siguiente', direction: 'forward' as const }));
  const id = `project-markdown-${Date.now()}`;
  return {
    schemaVersion: 1,
    id,
    name: heading || name.replace(/\.md$/i, ''),
    type: 'document',
    updated: Date.now(),
    nodes,
    edges,
    groups: [],
    pages: [{ id: 'page-main', title: 'Página principal', nodeIds: nodes.map((node) => node.id), edgeIds: edges.map((edge) => edge.id) }],
    sources: [{ id: 'source-markdown-import', kind: 'file', title: name, capturedAt: new Date().toISOString(), fragment: content.slice(0, 1000), nodeIds: nodes.map((node) => node.id), edgeIds: edges.map((edge) => edge.id), generatedBy: 'user' }],
    data: { document: content },
  };
}


type ExcalidrawElement = Record<string, unknown> & { id: string; type: string; x: number; y: number; width?: number; height?: number; text?: string; containerId?: string | null; isDeleted?: boolean; startBinding?: { elementId?: string; focus?: number; gap?: number } | null; endBinding?: { elementId?: string; focus?: number; gap?: number } | null };

/** Imports a bounded subset of Excalidraw JSON. Unknown elements are ignored; scripts are never executed. */
export function importExcalidraw(source: string, name = 'Dibujo Excalidraw'): Project {
  if (source.length > 5_000_000) throw new Error('El archivo Excalidraw supera el límite de 5 MB.');
  const document = JSON.parse(source) as { type?: unknown; elements?: unknown };
  if (document?.type !== 'excalidraw' || !Array.isArray(document.elements)) throw new Error('El archivo no parece un documento Excalidraw válido.');
  if (document.elements.length > 5000) throw new Error('El dibujo supera el límite de 5 000 elementos.');
  const elements = document.elements.filter((item): item is ExcalidrawElement => Boolean(item && typeof item === 'object' && typeof (item as ExcalidrawElement).id === 'string' && typeof (item as ExcalidrawElement).type === 'string' && Number.isFinite((item as ExcalidrawElement).x) && Number.isFinite((item as ExcalidrawElement).y) && Math.abs((item as ExcalidrawElement).x) < 1_000_000 && Math.abs((item as ExcalidrawElement).y) < 1_000_000 && !(item as ExcalidrawElement).isDeleted));
  const shapes = elements.filter((element) => ['rectangle', 'ellipse', 'diamond', 'text'].includes(element.type));
  const textByContainer = new Map(elements.filter((element) => element.type === 'text' && typeof element.containerId === 'string').map((element) => [element.containerId!, plainLabel(String(element.text ?? ''))]));
  const visibleShapes = shapes.filter((element) => element.type !== 'text' || !element.containerId);
  if (!visibleShapes.length) throw new Error('El dibujo no contiene formas o textos que Glyphind pueda importar.');
  const positions = visibleShapes.map((element) => ({ x: element.x, y: element.y }));
  const minX = Math.min(...positions.map((point) => point.x));
  const maxX = Math.max(...visibleShapes.map((element) => element.x + Math.max(1, Number(element.width) || 1)));
  const minY = Math.min(...positions.map((point) => point.y));
  const maxY = Math.max(...visibleShapes.map((element) => element.y + Math.max(1, Number(element.height) || 1)));
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const nodes: DiagramNode[] = visibleShapes.map((element, index) => ({
    id: `excalidraw-${slug(element.id, `node_${index + 1}`)}`,
    label: textByContainer.get(element.id) || plainLabel(String(element.text ?? element.originalText ?? element.id)) || `Elemento ${index + 1}`,
    detail: typeof element.customData === 'object' && element.customData !== null && typeof (element.customData as Record<string, unknown>).glyphindDetail === 'string' ? String((element.customData as Record<string, unknown>).glyphindDetail) : '',
    x: 8 + ((element.x - minX) / spanX) * 84,
    y: 8 + ((element.y - minY) / spanY) * 84,
    tone: typeof element.customData === 'object' && element.customData !== null && typeof (element.customData as Record<string, unknown>).glyphindTone === 'string' ? String((element.customData as Record<string, unknown>).glyphindTone) : ['blue', 'lilac', 'green', 'orange'][index % 4],
    ...(typeof element.customData === 'object' && element.customData !== null && typeof (element.customData as Record<string, unknown>).glyphindColorHex === 'string' && (element.customData as Record<string, unknown>).glyphindColorHex ? { colorHex: String((element.customData as Record<string, unknown>).glyphindColorHex) } : {}),
    shape: typeof element.customData === 'object' && element.customData !== null && ['card', 'circle', 'pill', 'diamond', 'hexagon'].includes(String((element.customData as Record<string, unknown>).glyphindShape)) ? String((element.customData as Record<string, unknown>).glyphindShape) as DiagramNode['shape'] : element.type === 'ellipse' ? 'circle' : element.type === 'diamond' ? 'diamond' : 'card',
    inference: 'user',
  }));
  const nodeIds = new Map(visibleShapes.map((element, index) => [element.id, nodes[index].id]));
  const labelsByArrow = new Map(elements.filter((element) => element.type === 'text' && typeof element.containerId === 'string').map((element) => [element.containerId!, plainLabel(String(element.text ?? ''))]));
  const edges: GlyphindEdge[] = elements.filter((element) => element.type === 'arrow' || element.type === 'line').flatMap((element, index) => {
    const from = element.startBinding?.elementId ? nodeIds.get(element.startBinding.elementId) : undefined;
    const to = element.endBinding?.elementId ? nodeIds.get(element.endBinding.elementId) : undefined;
    if (!from || !to || from === to) return [];
    const label = labelsByArrow.get(element.id);
    const direction = element.startArrowhead && element.endArrowhead ? 'both' : element.startArrowhead ? 'backward' : element.endArrowhead ? 'forward' : 'none';
    const customData = typeof element.customData === 'object' && element.customData !== null ? element.customData as Record<string, unknown> : {};
    const ports = ['auto', 'top', 'right', 'bottom', 'left'];
    const fromPort = ports.includes(String(customData.glyphindFromPort)) ? customData.glyphindFromPort as EdgePort : undefined;
    const toPort = ports.includes(String(customData.glyphindToPort)) ? customData.glyphindToPort as EdgePort : undefined;
    return [{ id: `excalidraw-edge-${index + 1}`, from, to, direction, ...(fromPort ? { fromPort } : {}), ...(toPort ? { toPort } : {}), ...(label ? { label, relation: label } : {}) }];
  });
  const id = `project-excalidraw-${Date.now()}`;
  return { schemaVersion: 1, id, name: name.replace(/\.excalidraw$/i, ''), type: 'flow', updated: Date.now(), nodes, edges, groups: [], pages: [{ id: 'page-main', title: 'Página principal', nodeIds: nodes.map((node) => node.id), edgeIds: edges.map((edge) => edge.id) }], sources: [] };
}

/** Exports an editable, self-contained Excalidraw document from the explicit Glyphind graph. */
export function exportExcalidraw(project: Project): string {
  const safeId = (value: string) => slug(value, 'glyphind_element').slice(0, 80);
  const scaleX = 8;
  const scaleY = 6;
  const elements: ExcalidrawElement[] = [];
  const shapeIds = new Map<string, string>();
  project.nodes.forEach((node, index) => {
    const id = `g_${safeId(node.id)}_${index}`;
    const textId = `t_${safeId(node.id)}_${index}`;
    shapeIds.set(node.id, id);
    const x = Math.round(node.x * scaleX);
    const y = Math.round(node.y * scaleY);
    const shape = node.shape === 'circle' ? 'ellipse' : node.shape === 'diamond' ? 'diamond' : 'rectangle';
    elements.push({ id, type: shape, x, y, width: 180, height: 76, angle: 0, customData: { glyphind: true, glyphindDetail: node.detail, glyphindTone: node.tone, glyphindColorHex: node.colorHex ?? '', glyphindShape: node.shape ?? 'card' }, strokeColor: /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(node.colorHex ?? '') ? node.colorHex! : '#343330', backgroundColor: '#ffffff', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: { type: 3 }, seed: index + 1, version: 1, versionNonce: index + 1, isDeleted: false, boundElements: [{ id: textId, type: 'text' }], link: null, locked: false });
    elements.push({ id: textId, type: 'text', x, y: y + 20, width: 180, height: 36, angle: 0, strokeColor: '#343330', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, seed: index + 501, version: 1, versionNonce: index + 501, isDeleted: false, boundElements: [], link: null, locked: false, fontSize: 18, fontFamily: 1, text: node.label, textAlign: 'center', verticalAlign: 'middle', containerId: id, originalText: node.label, autoResize: false, lineHeight: 1.25 });
  });
  project.edges.forEach((edge, index) => {
    const from = project.nodes.find((node) => node.id === edge.from);
    const to = project.nodes.find((node) => node.id === edge.to);
    const start = shapeIds.get(edge.from);
    const end = shapeIds.get(edge.to);
    if (!from || !to || !start || !end) return;
    const id = `g_edge_${safeId(edge.id)}_${index}`;
    const x1 = Math.round(from.x * scaleX + 90);
    const y1 = Math.round(from.y * scaleY + 38);
    const x2 = Math.round(to.x * scaleX + 90);
    const y2 = Math.round(to.y * scaleY + 38);
    elements.push({ id, type: edge.direction === 'none' ? 'line' : 'arrow', x: x1, y: y1, width: x2 - x1, height: y2 - y1, angle: 0, customData: { glyphind: true, glyphindDirection: edge.direction, glyphindFromPort: edge.fromPort ?? 'auto', glyphindToPort: edge.toPort ?? 'auto', glyphindColor: edge.style?.color ?? '', glyphindDashed: edge.style?.dashed ?? true }, strokeColor: /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(edge.style?.color ?? '') ? edge.style!.color! : '#6b6962', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: edge.style?.dashed === false ? 'solid' : 'dashed', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: index + 1001, version: 1, versionNonce: index + 1001, isDeleted: false, boundElements: [], link: null, locked: false, points: [[0, 0], [x2 - x1, y2 - y1]], startBinding: { elementId: start, focus: 0, gap: 1 }, endBinding: { elementId: end, focus: 0, gap: 1 }, startArrowhead: edge.direction === 'backward' || edge.direction === 'both' ? 'triangle' : null, endArrowhead: edge.direction === 'forward' || edge.direction === 'both' ? 'triangle' : null });
    const label = edge.label || edge.relation;
    if (label) elements.push({ id: `t_${safeId(edge.id)}_${index}`, type: 'text', x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) - 14, width: Math.min(240, Math.max(40, label.length * 9)), height: 24, angle: 0, strokeColor: '#343330', backgroundColor: '#ffffff', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, seed: index + 1501, version: 1, versionNonce: index + 1501, isDeleted: false, boundElements: [], link: null, locked: false, fontSize: 16, fontFamily: 1, text: label, textAlign: 'center', verticalAlign: 'middle', containerId: id, originalText: label, autoResize: true, lineHeight: 1.25 });
  });
  return JSON.stringify({ type: 'excalidraw', version: 2, source: 'Glyphind', elements, appState: { viewBackgroundColor: '#ffffff', gridSize: null, zoom: { value: 1 } }, files: {} }, null, 2);
}
