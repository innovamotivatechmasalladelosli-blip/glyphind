import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProject } from './model';
import { addMatrixColumn, createCycleEdges, ensureVennGroups, readMatrixData, removeMatrixColumn, renameMatrixColumn, reorderCycleNode, setMatrixCell, setVennMembership } from './semantics';

const project = normalizeProject({
  id: 'semantic', name: 'Comparación', type: 'matrix',
  nodes: [
    { id: 'a', label: 'Opción A', detail: '', x: 20, y: 20, tone: 'blue' },
    { id: 'b', label: 'Opción B', detail: '', x: 70, y: 20, tone: 'lilac' },
  ],
});

test('la matriz normaliza columnas, conserva celdas y limita filas a nodos del proyecto', () => {
  const data = readMatrixData({ ...project, data: { matrix: { columns: ['Costo', 'Costo', '  Calidad '], cells: { a: { Costo: '$', Calidad: 'Alta' }, stale: { Costo: 'ignorar' } } } } });
  assert.deepEqual(data.columns, ['Costo', 'Calidad']);
  assert.deepEqual(data.cells, { a: { Costo: '$', Calidad: 'Alta' }, b: { Costo: '', Calidad: '' } });
  assert.equal(setMatrixCell(data, 'a', 'Costo', '$$').cells.a.Costo, '$$');
});

test('la matriz permite crear, renombrar y retirar criterios sin perder valores', () => {
  const initial = readMatrixData(project);
  const withNew = setMatrixCell(addMatrixColumn(initial), 'a', 'Criterio 3', 'Sí');
  const renamed = renameMatrixColumn(withNew, 'Criterio 3', 'Impacto');
  assert.equal(renamed.cells.a.Impacto, 'Sí');
  assert.equal(renamed.cells.a['Criterio 3'], undefined);
  assert.equal(removeMatrixColumn(renamed, 'Criterio 1').columns.includes('Criterio 1'), false);
  assert.equal(removeMatrixColumn({ columns: ['Único'], cells: {} }, 'Único').columns.length, 1);
});

test('el ciclo conserva el orden y crea relaciones abiertas o cerradas sin bucles propios', () => {
  const closed = createCycleEdges(project.nodes, true);
  const open = createCycleEdges(project.nodes, false);
  assert.deepEqual(closed.map((edge) => [edge.from, edge.to]), [['a', 'b'], ['b', 'a']]);
  assert.deepEqual(open.map((edge) => [edge.from, edge.to]), [['a', 'b']]);
  assert.equal(createCycleEdges(project.nodes.slice(0, 1), true).length, 0);
  assert.deepEqual(reorderCycleNode(project.nodes, 'a', 1).map((node) => node.id), ['b', 'a']);
});

test('el diagrama de conjuntos inicializa A/B, mantiene items compartidos y cambia pertenencia', () => {
  const venn = normalizeProject({ ...project, type: 'venn', nodes: [
    { id: 'set-a', label: 'A', x: 0, y: 0, tone: 'blue' },
    { id: 'shared', label: 'AB', x: 0, y: 0, tone: 'dark' },
    { id: 'set-b', label: 'B', x: 0, y: 0, tone: 'lilac' },
  ] });
  const groups = ensureVennGroups(venn);
  assert.deepEqual(groups.map((group) => group.nodeIds), [['set-a', 'shared'], ['shared', 'set-b']]);
  const moved = setVennMembership(groups, 'set-a', 'set-b', true);
  assert.equal(moved[1].nodeIds.includes('set-a'), true);
  assert.deepEqual(ensureVennGroups({ ...venn, groups: moved }).map((group) => group.nodeIds), moved.map((group) => group.nodeIds));
});
