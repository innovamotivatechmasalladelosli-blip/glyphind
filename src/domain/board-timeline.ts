import type { BoardColumn, TimelineItem } from './model';

export function moveBoardCard(columns: BoardColumn[], cardId: string, targetColumnId: string): { columns: BoardColumn[]; moved: boolean; reason?: 'missing' | 'wip-limit' } {
  const source = columns.find((column) => column.cards.some((card) => card.id === cardId));
  const target = columns.find((column) => column.id === targetColumnId);
  if (!source || !target) return { columns, moved: false, reason: 'missing' };
  if (source.id === target.id) return { columns, moved: false };
  if (target.wipLimit !== undefined && target.cards.length >= target.wipLimit) return { columns, moved: false, reason: 'wip-limit' };
  const card = source.cards.find((item) => item.id === cardId)!;
  return {
    columns: columns.map((column) => column.id === source.id
      ? { ...column, cards: column.cards.filter((item) => item.id !== cardId) }
      : column.id === target.id ? { ...column, cards: [...column.cards, card] } : column),
    moved: true,
  };
}

export function reorderBoardColumn(columns: BoardColumn[], index: number, direction: -1 | 1): BoardColumn[] {
  const target = index + direction;
  if (index < 0 || index >= columns.length || target < 0 || target >= columns.length) return columns;
  const next = [...columns];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function canAddDependency(items: TimelineItem[], sourceId: string, targetId: string): boolean {
  if (!sourceId || !targetId || sourceId === targetId) return false;
  const byId = new Map(items.map((item) => [item.id, item]));
  if (!byId.has(sourceId) || !byId.has(targetId)) return false;
  const visited = new Set<string>();
  const stack = [targetId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === sourceId) return false;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(byId.get(current)?.dependsOn ?? []));
  }
  return true;
}

export function toggleDependency(items: TimelineItem[], sourceId: string, targetId: string): TimelineItem[] {
  const source = items.find((item) => item.id === sourceId);
  if (!source) return items;
  const dependsOn = source.dependsOn ?? [];
  if (dependsOn.includes(targetId)) {
    return items.map((item) => item.id === sourceId ? { ...item, dependsOn: dependsOn.filter((id) => id !== targetId) } : item);
  }
  if (!canAddDependency(items, sourceId, targetId)) return items;
  return items.map((item) => item.id === sourceId ? { ...item, dependsOn: [...dependsOn, targetId] } : item);
}
