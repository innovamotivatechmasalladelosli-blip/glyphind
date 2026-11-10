import type { DiagramNode, EdgePort, Project } from './model';

const WIDTH = 1200;
const HEIGHT = 800;
const NODE_WIDTH = 168;
const NODE_HEIGHT = 92;
const MARGIN = 24;
const MAX_COORDINATE = 1_000_000;
const COLORS: Record<string, string> = {
  blue: '#dbeafe',
  lilac: '#ede9fe',
  green: '#dcfce7',
  orange: '#ffedd5',
  rose: '#ffe4e6',
  yellow: '#fef3c7',
};

function escapeXml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]!);
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(value) ? value : fallback;
}

function coordinate(value: number, fallback: number): number {
  const finite = Number.isFinite(value) ? Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, value)) : fallback;
  return Math.max(0, Math.min(100, finite));
}

function point(node: DiagramNode): { x: number; y: number } {
  const xInset = NODE_WIDTH / 2 + MARGIN;
  const yInset = NODE_HEIGHT / 2 + MARGIN;
  return {
    x: xInset + (coordinate(node.x, 50) / 100) * (WIDTH - xInset * 2),
    y: yInset + (coordinate(node.y, 50) / 100) * (HEIGHT - yInset * 2),
  };
}

function edgePoint(center: { x: number; y: number }, other: { x: number; y: number }, port: EdgePort | undefined): { x: number; y: number } {
  const dx = other.x - center.x;
  const dy = other.y - center.y;
  const side = port && port !== 'auto' ? port : Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
  if (side === 'right') return { x: center.x + NODE_WIDTH / 2, y: center.y };
  if (side === 'left') return { x: center.x - NODE_WIDTH / 2, y: center.y };
  if (side === 'bottom') return { x: center.x, y: center.y + NODE_HEIGHT / 2 };
  return { x: center.x, y: center.y - NODE_HEIGHT / 2 };
}

function shapeMarkup(node: DiagramNode, x: number, y: number, fill: string): string {
  const left = x - NODE_WIDTH / 2;
  const top = y - NODE_HEIGHT / 2;
  const common = `fill="${fill}" stroke="#475569" stroke-width="2"`;
  switch (node.shape) {
    case 'circle': return `<ellipse cx="${x}" cy="${y}" rx="${NODE_WIDTH / 2}" ry="${NODE_HEIGHT / 2}" ${common}/>`;
    case 'pill': return `<rect x="${left}" y="${top}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="46" ${common}/>`;
    case 'diamond': return `<polygon points="${x},${top} ${left + NODE_WIDTH},${y} ${x},${top + NODE_HEIGHT} ${left},${y}" ${common}/>`;
    case 'hexagon': return `<polygon points="${left + 30},${top} ${left + NODE_WIDTH - 30},${top} ${left + NODE_WIDTH},${y} ${left + NODE_WIDTH - 30},${top + NODE_HEIGHT} ${left + 30},${top + NODE_HEIGHT} ${left},${y}" ${common}/>`;
    case 'card':
    default: return `<rect x="${left}" y="${top}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="14" ${common}/>`;
  }
}

/** Exporta el proyecto como SVG autocontenido; los datos nunca se interpretan como marcado. */
export function exportProjectSvg(project: Project): string {
  const nodes = Array.isArray(project.nodes) ? project.nodes : [];
  const edges = Array.isArray(project.edges) ? project.edges : [];
  const positions = new Map(nodes.map((node) => [node.id, point(node)]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edgeMarkup = edges.flatMap((edge) => {
    const start = positions.get(edge.from);
    const end = positions.get(edge.to);
    if (!start || !end || edge.from === edge.to) return [];
    const direction = ['none', 'forward', 'backward', 'both'].includes(edge.direction) ? edge.direction : 'none';
    const marker = direction === 'forward' ? ' marker-end="url(#arrow)"' : direction === 'backward' ? ' marker-start="url(#arrow)"' : direction === 'both' ? ' marker-start="url(#arrow)" marker-end="url(#arrow)"' : '';
    const color = safeColor(edge.style?.color, '#64748b');
    const source = edgePoint(start, end, edge.fromPort);
    const target = edgePoint(end, start, edge.toPort);
    const sx = source.x;
    const sy = source.y;
    const ex = target.x;
    const ey = target.y;
    const label = edge.label || edge.relation || '';
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2 - 8;
    return [`<g class="edge"><line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${color}" stroke-width="2"${edge.style?.dashed ? ' stroke-dasharray="7 5"' : ''}${marker}/>${label ? `<text x="${midX}" y="${midY}" text-anchor="middle" class="edge-label">${escapeXml(label)}</text>` : ''}</g>`];
  }).join('');
  const nodeMarkup = nodes.map((node) => {
    const { x, y } = positions.get(node.id)!;
    const fallback = COLORS[node.tone] ?? COLORS.blue;
    const fill = safeColor(node.colorHex, fallback);
    return `<g class="node" data-node-id="${escapeXml(node.id)}">${shapeMarkup(node, x, y, fill)}<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" class="node-label">${escapeXml(node.label)}</text></g>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="project-title"><title id="project-title">${escapeXml(project.name || 'Proyecto')}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs><style>.node-label{font:600 16px sans-serif;fill:#0f172a}.edge-label{font:14px sans-serif;fill:#334155;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}</style><rect width="100%" height="100%" fill="#fff"/>${edgeMarkup}${nodeMarkup}</svg>`;
}
