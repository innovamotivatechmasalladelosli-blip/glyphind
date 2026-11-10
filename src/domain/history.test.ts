import assert from 'node:assert/strict';
import test from 'node:test';
import { collectProjectDiff, describeProjectChange, mergeDiffs } from './history';
import { normalizeProject } from './model';

test('registra campos modificados y nodos añadidos/eliminados como diff', () => {
  const before = normalizeProject({ id: 'p', name: 'P', nodes: [{ id: 'a', label: 'Antes' }, { id: 'b', label: 'Eliminar' }] });
  const after = normalizeProject({ id: 'p', name: 'P2', nodes: [{ id: 'a', label: 'Después' }, { id: 'c', label: 'Nuevo' }] });
  const diff = collectProjectDiff(before, after);
  assert.ok(diff.some((item) => item.entity === 'proyecto' && item.field === 'name' && item.before === 'P' && item.after === 'P2'));
  assert.ok(diff.some((item) => item.id === 'a' && item.field === 'label' && item.before === 'Antes' && item.after === 'Después'));
  assert.ok(diff.some((item) => item.id === 'b' && item.field === 'eliminado'));
  assert.ok(diff.some((item) => item.id === 'c' && item.field === 'añadido'));
  assert.match(describeProjectChange(before, after), /nombre.*nodos/);
});

test('fusiona cambios coalescidos manteniendo el primer valor anterior y el último nuevo', () => {
  const first = [{ entity: 'nodo', id: 'a', field: 'label', before: 'A', after: 'Ab' }];
  const second = [{ entity: 'nodo', id: 'a', field: 'label', before: 'Ab', after: 'Abc' }];
  assert.deepEqual(mergeDiffs(first, second), [{ entity: 'nodo', id: 'a', field: 'label', before: 'A', after: 'Abc' }]);
  assert.deepEqual(mergeDiffs(first, [{ ...second[0], after: 'A' }]), []);
});
