import type { GlyphindOperationChange, Project } from './model';

function diffValue(value: unknown): string {
  if (value === undefined) return '—';
  if (typeof value === 'string') return value || '—';
  const serialized = JSON.stringify(value);
  return serialized.length > 240 ? `${serialized.slice(0, 237)}…` : serialized;
}

export function collectProjectDiff(before: Project, after: Project): GlyphindOperationChange[] {
  const changes: GlyphindOperationChange[] = [];
  const compareFields = (entity: string, id: string, left: Record<string, unknown>, right: Record<string, unknown>) => {
    for (const field of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) changes.push({ entity, id, field, before: diffValue(left[field]), after: diffValue(right[field]) });
    }
  };
  for (const field of ['name', 'type'] as const) if (before[field] !== after[field]) changes.push({ entity: 'proyecto', id: before.id, field, before: diffValue(before[field]), after: diffValue(after[field]) });
  const collections = [
    ['nodo', before.nodes, after.nodes], ['conector', before.edges, after.edges], ['grupo', before.groups, after.groups], ['página', before.pages, after.pages], ['fuente', before.sources, after.sources],
  ] as const;
  for (const [entity, leftItems, rightItems] of collections) {
    const left = new Map(leftItems.map((item) => [item.id, item as unknown as Record<string, unknown>]));
    const right = new Map(rightItems.map((item) => [item.id, item as unknown as Record<string, unknown>]));
    for (const id of new Set([...left.keys(), ...right.keys()])) {
      const a = left.get(id); const b = right.get(id);
      if (!a || !b) changes.push({ entity, id, field: a ? 'eliminado' : 'añadido', before: a ? diffValue(a) : '—', after: b ? diffValue(b) : '—' });
      else compareFields(entity, id, a, b);
    }
  }
  if (JSON.stringify(before.data) !== JSON.stringify(after.data)) changes.push({ entity: 'contenido', id: after.id, field: 'datos', before: diffValue(before.data), after: diffValue(after.data) });
  return changes.slice(0, 80);
}

export function mergeDiffs(previous: GlyphindOperationChange[], current: GlyphindOperationChange[]): GlyphindOperationChange[] {
  const merged = new Map(previous.map((change) => [`${change.entity}:${change.id}:${change.field}`, change]));
  for (const change of current) {
    const key = `${change.entity}:${change.id}:${change.field}`;
    const existing = merged.get(key);
    if (existing) merged.set(key, { ...existing, after: change.after }); else merged.set(key, change);
  }
  return [...merged.values()].filter((change) => change.before !== change.after).slice(0, 80);
}

export function describeProjectChange(before: Project, after: Project): string {
  const changed: string[] = [];
  if (before.name !== after.name) changed.push('nombre');
  if (before.type !== after.type) changed.push('tipo de diagrama');
  if (JSON.stringify(before.nodes) !== JSON.stringify(after.nodes)) changed.push('nodos');
  if (JSON.stringify(before.edges) !== JSON.stringify(after.edges)) changed.push('conectores');
  if (JSON.stringify(before.groups) !== JSON.stringify(after.groups)) changed.push('grupos');
  if (JSON.stringify(before.pages) !== JSON.stringify(after.pages)) changed.push('páginas');
  if (JSON.stringify(before.sources) !== JSON.stringify(after.sources)) changed.push('fuentes');
  if (JSON.stringify(before.data) !== JSON.stringify(after.data)) changed.push('contenido');
  return changed.length ? `Cambio en ${changed.join(', ')}` : 'Cambio del proyecto';
}
