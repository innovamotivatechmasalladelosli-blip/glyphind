import type { Project, DiagramNode, GlyphindEdge, GlyphindGroup, GlyphindPage, GlyphindSource, ProjectData } from './model';

export type LocalTemplate = {
  schemaVersion: 1;
  id: string;
  name: string;
  type: string;
  nodes: DiagramNode[];
  edges: GlyphindEdge[];
  groups: GlyphindGroup[];
  pages: GlyphindPage[];
  sources: GlyphindSource[];
  data?: ProjectData;
};

export type TemplateStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const LOCAL_TEMPLATES_STORAGE_KEY = 'glyphind-local-templates-v1';
export const TEMPLATE_LIMITS = { storageBytes: 2_000_000, templates: 100, nodes: 2_000, edges: 5_000, groups: 500, pages: 500, sources: 2_000 } as const;

const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const arr = (v: unknown): v is unknown[] => Array.isArray(v);
const boundedString = (v: unknown, max = 100_000) => str(v) && v.length <= max;
const uniqueIds = (values: unknown[]): boolean => values.every((v) => obj(v) && str(v.id)) && new Set(values.map((v) => (v as { id: string }).id)).size === values.length;

/** Validates only JSON data; strings containing markup/scripts are retained as inert data and never evaluated. */
export function isLocalTemplate(value: unknown): value is LocalTemplate {
  if (!obj(value) || value.schemaVersion !== 1 || !str(value.id) || !boundedString(value.name, 500) || !str(value.type)) return false;
  if (!arr(value.nodes) || !arr(value.edges) || !arr(value.groups) || !arr(value.pages) || !arr(value.sources)) return false;
  const nodes: unknown[] = value.nodes;
  const edges: unknown[] = value.edges;
  const groups: unknown[] = value.groups;
  const pages: unknown[] = value.pages;
  const sources: unknown[] = value.sources;
  if (nodes.length > TEMPLATE_LIMITS.nodes || edges.length > TEMPLATE_LIMITS.edges || groups.length > TEMPLATE_LIMITS.groups || pages.length > TEMPLATE_LIMITS.pages || sources.length > TEMPLATE_LIMITS.sources) return false;
  if (![nodes, edges, groups, pages, sources].every(uniqueIds)) return false;
  const nodeIds = new Set(nodes.map((n) => (n as { id: string }).id));
  const edgeIds = new Set(edges.map((e) => (e as { id: string }).id));
  if (!nodes.every((n) => obj(n) && boundedString(n.id, 500) && boundedString(n.label, 10_000) && boundedString(n.detail, 100_000) && Number.isFinite(n.x) && Number.isFinite(n.y) && str(n.tone))) return false;
  if (!edges.every((e) => obj(e) && boundedString(e.id, 500) && str(e.from) && nodeIds.has(e.from) && str(e.to) && nodeIds.has(e.to) && ['none', 'forward', 'backward', 'both'].includes(String(e.direction)))) return false;
  if (!groups.every((g) => obj(g) && str(g.id) && str(g.label) && arr(g.nodeIds) && g.nodeIds.every((id) => str(id) && nodeIds.has(id)))) return false;
  if (!pages.every((p) => obj(p) && str(p.id) && str(p.title) && arr(p.nodeIds) && p.nodeIds.every((id) => str(id) && nodeIds.has(id)) && arr(p.edgeIds) && p.edgeIds.every((id) => str(id) && edgeIds.has(id)))) return false;
  if (!sources.every((s) => obj(s) && str(s.id) && ['url', 'text', 'html', 'file', 'inference'].includes(String(s.kind)) && str(s.capturedAt) && (s.nodeIds === undefined || (arr(s.nodeIds) && s.nodeIds.every((id) => str(id) && nodeIds.has(id)))) && (s.edgeIds === undefined || (arr(s.edgeIds) && s.edgeIds.every((id) => str(id) && edgeIds.has(id)))))) return false;
  try { return JSON.stringify(value).length <= TEMPLATE_LIMITS.storageBytes; } catch { return false; }
}

function migrateTemplate(value: unknown, index: number): LocalTemplate | null {
  if (isLocalTemplate(value)) return value;
  if (!obj(value) || !str(value.id) || !str(value.name) || !str(value.type) || !arr(value.nodes) || !arr(value.edges)) return null;
  const nodes = value.nodes as DiagramNode[];
  const nodeIds = new Set(nodes.filter((n) => obj(n) && str(n.id)).map((n) => n.id));
  const edges = (value.edges as GlyphindEdge[]).filter((e) => obj(e) && nodeIds.has(e.from) && nodeIds.has(e.to));
  const edgeIds = new Set(edges.map((e) => e.id));
  const groups = arr(value.groups) ? value.groups as GlyphindGroup[] : [];
  const pages = arr(value.pages) ? value.pages as GlyphindPage[] : [];
  const sources = arr(value.sources) ? value.sources as GlyphindSource[] : [];
  const candidate: LocalTemplate = { schemaVersion: 1, id: value.id, name: value.name, type: value.type, nodes, edges,
    groups: groups.map((g) => ({ ...g, nodeIds: arr(g.nodeIds) ? g.nodeIds.filter((id) => nodeIds.has(id)) : [] })),
    pages: pages.map((p) => ({ ...p, nodeIds: arr(p.nodeIds) ? p.nodeIds.filter((id) => nodeIds.has(id)) : [], edgeIds: arr(p.edgeIds) ? p.edgeIds.filter((id) => edgeIds.has(id)) : [] })),
    sources: sources.map((s) => ({ ...s, ...(s.nodeIds ? { nodeIds: s.nodeIds.filter((id) => nodeIds.has(id)) } : {}), ...(s.edgeIds ? { edgeIds: s.edgeIds.filter((id) => edgeIds.has(id)) } : {}) })),
    ...(obj(value.data) ? { data: value.data as ProjectData } : {}),
  };
  return isLocalTemplate(candidate) ? candidate : (index < 0 ? null : null);
}

export function readLocalTemplates(storage: TemplateStorage): LocalTemplate[] {
  let raw: unknown;
  try {
    const text = storage.getItem(LOCAL_TEMPLATES_STORAGE_KEY);
    if (!text || text.length > TEMPLATE_LIMITS.storageBytes) return [];
    raw = JSON.parse(text);
  } catch { return []; }
  const entries = arr(raw) ? raw : obj(raw) && arr(raw.templates) ? raw.templates : null;
  if (!entries) return [];
  const result = entries.slice(0, TEMPLATE_LIMITS.templates).map((entry, i) => migrateTemplate(entry, i)).filter((t): t is LocalTemplate => t !== null);
  return result;
}

export function writeLocalTemplates(templates: LocalTemplate[], storage: TemplateStorage): void {
  if (!arr(templates) || templates.length > TEMPLATE_LIMITS.templates || !templates.every(isLocalTemplate)) throw new TypeError('Plantillas inválidas o fuera de los límites permitidos');
  const serialized = JSON.stringify(templates);
  if (serialized.length > TEMPLATE_LIMITS.storageBytes) throw new RangeError('El almacenamiento de plantillas excede el límite permitido');
  storage.setItem(LOCAL_TEMPLATES_STORAGE_KEY, serialized);
}

export function createLocalTemplate(project: Project, name = project.name): LocalTemplate {
  const template: LocalTemplate = { schemaVersion: 1, id: `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name, type: project.type,
    nodes: structuredClone(project.nodes), edges: structuredClone(project.edges), groups: structuredClone(project.groups), pages: structuredClone(project.pages), sources: structuredClone(project.sources),
    ...(project.data ? { data: structuredClone(project.data) } : {}),
  };
  if (!isLocalTemplate(template)) throw new TypeError('El proyecto excede los límites o no es una plantilla válida');
  return template;
}

export function applyLocalTemplate(project: Project, template: LocalTemplate): Project {
  if (!isLocalTemplate(template)) throw new TypeError('Plantilla inválida');
  const nodeMap = new Map(template.nodes.map((node, i) => [node.id, `${project.id}-node-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`]));
  const edgeMap = new Map(template.edges.map((edge, i) => [edge.id, `${project.id}-edge-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`]));
  const nodeIds = new Set(nodeMap.keys());
  const edgeIds = new Set(edgeMap.keys());
  const nodes = template.nodes.map((node) => ({ ...structuredClone(node), id: nodeMap.get(node.id)! }));
  const edges = template.edges.map((edge) => ({ ...structuredClone(edge), id: edgeMap.get(edge.id)!, from: nodeMap.get(edge.from)!, to: nodeMap.get(edge.to)! }));
  return { ...project, type: template.type, nodes, edges,
    groups: template.groups.map((g) => ({ ...structuredClone(g), nodeIds: g.nodeIds.filter((id) => nodeIds.has(id)).map((id) => nodeMap.get(id)!) })),
    pages: template.pages.map((p) => ({ ...structuredClone(p), nodeIds: p.nodeIds.filter((id) => nodeIds.has(id)).map((id) => nodeMap.get(id)!), edgeIds: p.edgeIds.filter((id) => edgeIds.has(id)).map((id) => edgeMap.get(id)!) })),
    sources: template.sources.map((s) => ({ ...structuredClone(s), ...(s.nodeIds ? { nodeIds: s.nodeIds.filter((id) => nodeIds.has(id)).map((id) => nodeMap.get(id)!) } : {}), ...(s.edgeIds ? { edgeIds: s.edgeIds.filter((id) => edgeIds.has(id)).map((id) => edgeMap.get(id)!) } : {}) })),
    ...(template.data === undefined ? { data: undefined } : { data: structuredClone(template.data) }),
  };
}
