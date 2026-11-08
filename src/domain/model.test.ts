import assert from 'node:assert/strict';
import test from 'node:test';
import { createEdgesFromNodes, createWorkspaceEnvelope, migrateProjects, normalizeProject } from './model';

test('migra un proyecto legado a Glyphind v1 sin perder nodos', () => {
  const [project] = migrateProjects([{
    id: 'legacy-1',
    name: 'Flujo legado',
    type: 'flow',
    updated: 123,
    nodes: [
      { id: 'a', label: 'Inicio', detail: 'Entrada', x: 10, y: 20, tone: 'blue' },
      { id: 'b', label: 'Salida', detail: 'Resultado', x: 70, y: 20, tone: 'green' },
    ],
  }]);
  assert.equal(project.schemaVersion, 1);
  assert.equal(project.nodes.length, 2);
  assert.equal(project.edges.length, 1);
  assert.equal(project.edges[0].from, 'a');
  assert.equal(project.edges[0].to, 'b');
  assert.equal(project.pages[0].nodeIds.length, 2);
});

test('conserva relaciones explícitas y descarta endpoints inválidos', () => {
  const project = normalizeProject({
    id: 'explicit-1',
    name: 'Mapa',
    type: 'concept',
    nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    edges: [
      { id: 'valid', from: 'a', to: 'b', direction: 'both', relation: 'influye' },
      { id: 'invalid', from: 'a', to: 'missing', direction: 'forward' },
    ],
  });
  assert.equal(project.edges.length, 1);
  assert.equal(project.edges[0].relation, 'influye');
  assert.equal(project.edges[0].direction, 'both');
});

test('crea sobre reversible con schemaVersion', () => {
  const nodes = [{ id: 'a', label: 'A', detail: '', x: 10, y: 10, tone: 'blue' }, { id: 'b', label: 'B', detail: '', x: 50, y: 10, tone: 'green' }];
  const project = normalizeProject({ id: 'p', name: 'Portable', type: 'flow', nodes, edges: createEdgesFromNodes('flow', nodes) });
  const envelope = createWorkspaceEnvelope([project]);
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.projects[0].edges[0].from, 'a');
  assert.equal(migrateProjects(envelope).length, 1);
});
