export type NodeShape = 'card' | 'circle' | 'pill' | 'diamond' | 'hexagon';

export type DiagramNode = {
  id: string;
  label: string;
  detail: string;
  x: number;
  y: number;
  tone: string;
  shape?: NodeShape;
  colorHex?: string;
  sourceUrl?: string;
  content?: string;
  evidenceId?: string;
  inference?: 'user' | 'rules' | 'local-model';
  confidence?: number;
};

export type EdgeDirection = 'none' | 'forward' | 'backward' | 'both';
export type EdgePort = 'auto' | 'top' | 'right' | 'bottom' | 'left';

export type GlyphindEdge = {
  id: string;
  from: string;
  to: string;
  relation?: string;
  direction: EdgeDirection;
  fromPort?: EdgePort;
  toPort?: EdgePort;
  label?: string;
  confidence?: number;
  style?: { color?: string; dashed?: boolean };
};

export type GlyphindSource = {
  id: string;
  kind: 'url' | 'text' | 'html' | 'file' | 'inference';
  url?: string;
  title?: string;
  capturedAt: string;
  fragment?: string;
  selector?: string;
  nodeIds?: string[];
  edgeIds?: string[];
  generatedBy?: 'user' | 'rules' | 'local-model';
  confidence?: number;
};

export type GlyphindGroup = { id: string; label: string; nodeIds: string[]; color?: string };
export type GlyphindPage = { id: string; title: string; nodeIds: string[]; edgeIds: string[] };
export type GlyphindOperationChange = { entity: string; id: string; field: string; before: string; after: string };
export type GlyphindOperation = { id: string; at: string; type: string; summary: string; changes?: GlyphindOperationChange[] };

export type Slide = { id: string; title: string; body: string; diagramProjectId?: string };
export type BoardCard = { id: string; title: string; detail: string };
export type BoardColumn = { id: string; title: string; cards: BoardCard[]; wipLimit?: number };
export type TimelineItem = { id: string; title: string; date: string; detail: string; duration?: string; dependsOn?: string[] };
export type MatrixData = { columns: string[]; cells: Record<string, Record<string, string>> };
export type CycleData = { closedLoop: boolean };
export type ProjectData = { document?: string; slides?: Slide[]; board?: BoardColumn[]; timeline?: TimelineItem[]; matrix?: MatrixData; cycle?: CycleData };

export type Project = {
  schemaVersion: 1;
  id: string;
  name: string;
  type: string;
  updated: number;
  nodes: DiagramNode[];
  edges: GlyphindEdge[];
  groups: GlyphindGroup[];
  pages: GlyphindPage[];
  sources: GlyphindSource[];
  history?: GlyphindOperation[];
  data?: ProjectData;
};

export type WorkspaceEnvelope = { schemaVersion: 1; exportedAt: string; projects: Project[] };

const nowIso = () => new Date().toISOString();

export function createEdgesFromNodes(projectType: string, nodes: DiagramNode[]): GlyphindEdge[] {
  if (nodes.length < 2) return [];
  const central = ['mindmap', 'concept', 'team', 'community'].includes(projectType);
  const pairs: Array<readonly [DiagramNode, DiagramNode]> = central
    ? nodes.slice(1).map((node) => [nodes[0], node] as const)
    : nodes.slice(0, -1).map((node, index) => [node, nodes[index + 1]] as const);
  if (projectType === 'cycle') pairs.push([nodes[nodes.length - 1], nodes[0]]);
  return pairs.map(([from, to], index) => ({
    id: projectType === 'cycle' ? `cycle:${from.id}:${to.id}` : `edge-${from.id}-${to.id}-${index}`,
    from: from.id,
    to: to.id,
    direction: 'forward',
    relation: central ? 'relacionado con' : projectType === 'cycle' ? 'siguiente paso' : 'siguiente',
    confidence: 1,
  }));
}

function normalizeNode(input: Partial<DiagramNode>, index: number): DiagramNode {
  return {
    id: String(input.id || `node-${index + 1}`),
    label: String(input.label || `Elemento ${index + 1}`),
    detail: String(input.detail || ''),
    x: Number.isFinite(input.x) ? Number(input.x) : 15 + (index % 4) * 22,
    y: Number.isFinite(input.y) ? Number(input.y) : 20 + Math.floor(index / 4) * 24,
    tone: String(input.tone || ['blue', 'lilac', 'green', 'orange'][index % 4]),
    ...(input.shape ? { shape: input.shape } : {}),
    ...(input.colorHex ? { colorHex: String(input.colorHex) } : {}),
    ...(input.sourceUrl ? { sourceUrl: String(input.sourceUrl) } : {}),
    ...(input.content ? { content: String(input.content) } : {}),
    ...(input.evidenceId ? { evidenceId: String(input.evidenceId) } : {}),
    inference: input.inference || 'user',
    ...(typeof input.confidence === 'number' ? { confidence: input.confidence } : {}),
  };
}

function normalizeEdge(input: Partial<GlyphindEdge>, index: number, nodes: DiagramNode[]): GlyphindEdge | null {
  const from = String(input.from || '');
  const to = String(input.to || '');
  if (!nodes.some((node) => node.id === from) || !nodes.some((node) => node.id === to) || from === to) return null;
  const direction = input.direction === 'none' || input.direction === 'backward' || input.direction === 'both' ? input.direction : 'forward';
  return {
    id: String(input.id || `edge-${from}-${to}-${index}`),
    from,
    to,
    direction,
    ...(input.fromPort === 'top' || input.fromPort === 'right' || input.fromPort === 'bottom' || input.fromPort === 'left' ? { fromPort: input.fromPort } : {}),
    ...(input.toPort === 'top' || input.toPort === 'right' || input.toPort === 'bottom' || input.toPort === 'left' ? { toPort: input.toPort } : {}),
    ...(input.relation ? { relation: String(input.relation) } : {}),
    ...(input.label ? { label: String(input.label) } : {}),
    ...(typeof input.confidence === 'number' ? { confidence: Math.max(0, Math.min(1, input.confidence)) } : {}),
    ...(input.style ? { style: input.style } : {}),
  };
}

export function normalizeProject(input: unknown): Project {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<Project>;
  const nodes = Array.isArray(raw.nodes) ? raw.nodes.map((node, index) => normalizeNode(node as Partial<DiagramNode>, index)) : [];
  const suppliedEdges = Array.isArray(raw.edges)
    ? raw.edges.map((edge, index) => normalizeEdge(edge as Partial<GlyphindEdge>, index, nodes)).filter((edge): edge is GlyphindEdge => Boolean(edge))
    : [];
  const edges = suppliedEdges.length || nodes.length < 2 ? suppliedEdges : createEdgesFromNodes(String(raw.type || 'flow'), nodes);
  const sourceIds = new Set((Array.isArray(raw.sources) ? raw.sources : []).map((source) => String((source as GlyphindSource).id)));
  const migratedSources = nodes.filter((node) => node.sourceUrl && !sourceIds.has(`source-${node.id}`)).map((node) => ({
    id: `source-${node.id}`,
    kind: 'url' as const,
    url: node.sourceUrl,
    title: node.label,
    capturedAt: nowIso(),
    fragment: node.content?.slice(0, 280),
    nodeIds: [node.id],
    generatedBy: 'user' as const,
  }));
  const sources = [...(Array.isArray(raw.sources) ? raw.sources as GlyphindSource[] : []), ...migratedSources];
  const project: Project = {
    schemaVersion: 1,
    id: String(raw.id || `project-${Date.now()}`),
    name: String(raw.name || 'Proyecto sin título'),
    type: String(raw.type || 'flow'),
    updated: Number(raw.updated) || Date.now(),
    nodes,
    edges,
    groups: Array.isArray(raw.groups) ? raw.groups as GlyphindGroup[] : [],
    pages: Array.isArray(raw.pages) ? raw.pages as GlyphindPage[] : [{ id: 'page-main', title: 'Página principal', nodeIds: nodes.map((node) => node.id), edgeIds: edges.map((edge) => edge.id) }],
    sources,
    ...(Array.isArray(raw.history) ? { history: raw.history as GlyphindOperation[] } : {}),
    ...(raw.data ? { data: raw.data } : {}),
  };
  return project;
}

export function migrateProjects(input: unknown): Project[] {
  const candidates = Array.isArray(input) ? input : (input && typeof input === 'object' && Array.isArray((input as { projects?: unknown }).projects) ? (input as { projects: unknown[] }).projects : []);
  return candidates.filter(Boolean).map(normalizeProject);
}

export function createWorkspaceEnvelope(projects: Project[]): WorkspaceEnvelope {
  return { schemaVersion: 1, exportedAt: nowIso(), projects: projects.map(normalizeProject) };
}
