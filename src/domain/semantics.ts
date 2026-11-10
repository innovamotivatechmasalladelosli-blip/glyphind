import type { CycleData, DiagramNode, GlyphindEdge, GlyphindGroup, MatrixData, Project } from './model';

export const DEFAULT_MATRIX_COLUMNS = ['Criterio 1', 'Criterio 2'];
export const MAX_MATRIX_COLUMNS = 12;

export function readMatrixData(project: Project): MatrixData {
  const raw = project.data?.matrix;
  const columns = Array.isArray(raw?.columns)
    ? [...new Set(raw.columns.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))].slice(0, MAX_MATRIX_COLUMNS)
    : [];
  const safeColumns = columns.length ? columns : DEFAULT_MATRIX_COLUMNS;
  const rawCells = raw?.cells && typeof raw.cells === 'object' ? raw.cells : {};
  const cells = Object.fromEntries(project.nodes.map((node) => {
    const row = rawCells[node.id] && typeof rawCells[node.id] === 'object' ? rawCells[node.id] : {};
    return [node.id, Object.fromEntries(safeColumns.map((column) => [column, typeof row[column] === 'string' ? row[column] : '']))];
  }));
  return { columns: safeColumns, cells };
}

export function setMatrixCell(data: MatrixData, nodeId: string, column: string, value: string): MatrixData {
  if (!data.columns.includes(column)) return data;
  return { ...data, cells: { ...data.cells, [nodeId]: { ...(data.cells[nodeId] ?? {}), [column]: value } } };
}

export function addMatrixColumn(data: MatrixData): MatrixData {
  if (data.columns.length >= MAX_MATRIX_COLUMNS) return data;
  let suffix = data.columns.length + 1;
  let title = `Criterio ${suffix}`;
  while (data.columns.includes(title)) title = `Criterio ${++suffix}`;
  return { columns: [...data.columns, title], cells: Object.fromEntries(Object.entries(data.cells).map(([id, row]) => [id, { ...row, [title]: '' }])) };
}

export function renameMatrixColumn(data: MatrixData, column: string, title: string): MatrixData {
  const nextTitle = title.trim().slice(0, 80);
  if (!nextTitle || !data.columns.includes(column) || (nextTitle !== column && data.columns.includes(nextTitle))) return data;
  return {
    columns: data.columns.map((item) => item === column ? nextTitle : item),
    cells: Object.fromEntries(Object.entries(data.cells).map(([id, row]) => {
      const { [column]: value, ...rest } = row;
      return [id, { ...rest, [nextTitle]: value ?? '' }];
    })),
  };
}

export function removeMatrixColumn(data: MatrixData, column: string): MatrixData {
  if (data.columns.length <= 1 || !data.columns.includes(column)) return data;
  return { columns: data.columns.filter((item) => item !== column), cells: Object.fromEntries(Object.entries(data.cells).map(([id, row]) => {
    const { [column]: _removed, ...rest } = row;
    return [id, rest];
  })) };
}

export function readCycleData(project: Project): CycleData {
  return { closedLoop: project.data?.cycle?.closedLoop !== false };
}

export function createCycleEdges(nodes: DiagramNode[], closedLoop: boolean): GlyphindEdge[] {
  const pairs: Array<[DiagramNode, DiagramNode]> = nodes.slice(0, -1).map((node, index) => [node, nodes[index + 1]]);
  if (closedLoop && nodes.length > 1) pairs.push([nodes[nodes.length - 1], nodes[0]]);
  return pairs.map(([from, to]) => ({ id: `cycle:${from.id}:${to.id}`, from: from.id, to: to.id, direction: 'forward', relation: 'siguiente paso', confidence: 1 }));
}

export function reorderCycleNode(nodes: DiagramNode[], nodeId: string, offset: -1 | 1): DiagramNode[] {
  const index = nodes.findIndex((node) => node.id === nodeId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= nodes.length) return nodes;
  const next = [...nodes];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function ensureVennGroups(project: Project): GlyphindGroup[] {
  const nodeIds = new Set(project.nodes.map((node) => node.id));
  const groups = (project.groups ?? []).map((group) => ({ ...group, nodeIds: (Array.isArray(group.nodeIds) ? group.nodeIds : []).filter((id) => nodeIds.has(id)) }));
  if (groups.length >= 2) return groups;
  const defaults: GlyphindGroup[] = [
    { id: 'set-a', label: 'Grupo A', nodeIds: project.nodes.filter((node) => node.id === 'set-a' || node.id.startsWith('set-a-') || node.id === 'shared' || node.id.startsWith('shared-') || ['Grupo A', 'En común'].includes(node.label)).map((node) => node.id), color: '#7c72d6' },
    { id: 'set-b', label: 'Grupo B', nodeIds: project.nodes.filter((node) => node.id === 'set-b' || node.id.startsWith('set-b-') || node.id === 'shared' || node.id.startsWith('shared-') || ['Grupo B', 'En común'].includes(node.label)).map((node) => node.id), color: '#df78af' },
  ];
  return groups.length ? [groups[0], defaults[1]] : defaults;
}

export function setVennMembership(groups: GlyphindGroup[], nodeId: string, groupId: string, included: boolean): GlyphindGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return group;
    const nodeIds = included
      ? [...new Set([...group.nodeIds, nodeId])]
      : group.nodeIds.filter((id) => id !== nodeId);
    return { ...group, nodeIds };
  });
}

export function addVennItem(nodes: DiagramNode[], label = 'Nuevo elemento'): DiagramNode[] {
  const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return [...nodes, { id, label, detail: '', x: 50, y: 50, tone: 'blue' }];
}
