import assert from 'node:assert/strict';
import test from 'node:test';
import type { BoardColumn, TimelineItem } from './model';
import { canAddDependency, moveBoardCard, reorderBoardColumn, toggleDependency } from './board-timeline';

const board: BoardColumn[] = [
  { id: 'todo', title: 'Pendiente', cards: [{ id: 'a', title: 'A', detail: '' }] },
  { id: 'doing', title: 'En curso', cards: [{ id: 'b', title: 'B', detail: '' }], wipLimit: 1 },
  { id: 'done', title: 'Hecho', cards: [] },
];

test('mueve tarjetas a una columna elegida y aplica límites WIP', () => {
  const blocked = moveBoardCard(board, 'a', 'doing');
  assert.equal(blocked.moved, false);
  assert.equal(blocked.reason, 'wip-limit');
  const moved = moveBoardCard(board, 'a', 'done');
  assert.equal(moved.moved, true);
  assert.equal(moved.columns[2].cards[0].id, 'a');
  assert.equal(board[0].cards[0].id, 'a');
});

test('reordena columnas sin mutar el arreglo original', () => {
  assert.deepEqual(reorderBoardColumn(board, 2, -1).map((column) => column.id), ['todo', 'done', 'doing']);
  assert.deepEqual(reorderBoardColumn(board, 0, -1), board);
});

test('permite dependencias acíclicas y bloquea referencias propias o ciclos', () => {
  const items: TimelineItem[] = [
    { id: 'a', title: 'A', date: '', detail: '' },
    { id: 'b', title: 'B', date: '', detail: '', dependsOn: ['a'] },
    { id: 'c', title: 'C', date: '', detail: '' },
  ];
  assert.equal(canAddDependency(items, 'c', 'b'), true);
  assert.equal(canAddDependency(items, 'a', 'b'), false);
  assert.equal(canAddDependency(items, 'a', 'a'), false);
  assert.deepEqual(toggleDependency(items, 'c', 'b')[2].dependsOn, ['b']);
  assert.equal(toggleDependency(items, 'a', 'b'), items);
  assert.deepEqual(toggleDependency(toggleDependency(items, 'c', 'b'), 'c', 'b')[2].dependsOn, []);
});
