import assert from 'node:assert/strict';
import test from 'node:test';
import { latestRecoverableSnapshot } from './recovery';

test('elige el snapshot recuperable más reciente sin mutar la lista original', () => {
  const snapshots = [{ savedAt: 10, projects: ['viejo'] }, { savedAt: 30, projects: ['nuevo'] }, { savedAt: 20, projects: ['medio'] }];
  assert.deepEqual(latestRecoverableSnapshot<string>(snapshots), { savedAt: 30, projects: ['nuevo'] });
  assert.equal(snapshots[0].savedAt, 10);
});

test('ignora snapshots con fecha inválida o proyectos no serializados como arreglo', () => {
  const snapshots = [{ savedAt: 40, projects: null }, { savedAt: Number.NaN, projects: ['inválido'] }, { savedAt: 2, projects: ['válido'] }];
  assert.deepEqual(latestRecoverableSnapshot<string>(snapshots), { savedAt: 2, projects: ['válido'] });
  assert.equal(latestRecoverableSnapshot([]), undefined);
});
