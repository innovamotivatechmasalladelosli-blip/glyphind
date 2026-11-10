import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProject } from './model';
import { applyLocalTemplate, createLocalTemplate, isLocalTemplate, LOCAL_TEMPLATES_STORAGE_KEY, readLocalTemplates, writeLocalTemplates } from './templates';

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return { getItem: (_key: string) => value, setItem: (_key: string, next: string) => { value = next; }, value: () => value };
}

function fixture() {
  return normalizeProject({ id: 'source-project', name: 'Origen', type: 'concept', updated: 7,
    nodes: [{ id: 'n1', label: 'A', detail: '', x: 1, y: 2, tone: 'blue' }, { id: 'n2', label: 'B', detail: '', x: 3, y: 4, tone: 'green' }],
    edges: [{ id: 'e1', from: 'n1', to: 'n2', direction: 'forward' }],
    groups: [{ id: 'g1', label: 'Grupo', nodeIds: ['n1', 'n2'] }],
    pages: [{ id: 'p1', title: 'Página', nodeIds: ['n1', 'n2'], edgeIds: ['e1'] }],
    sources: [{ id: 's1', kind: 'text', capturedAt: '2026-01-01', nodeIds: ['n1'], edgeIds: ['e1'] }],
    data: { document: 'contenido', slides: [{ id: 'sl1', title: 'Idea', body: 'Detalle' }] },
  });
}

test('round-trip de escritura y lectura de plantillas locales v1', () => {
  const storage = memoryStorage();
  const template = createLocalTemplate(fixture(), 'Mi plantilla');
  writeLocalTemplates([template], storage);
  assert.equal(storage.value() !== null, true);
  assert.deepEqual(readLocalTemplates(storage), [template]);
  assert.equal(isLocalTemplate(JSON.parse(storage.value()!)[0]), true);
});

test('JSON corrupto o formato inválido se maneja como lista vacía', () => {
  assert.deepEqual(readLocalTemplates(memoryStorage('{')), []);
  assert.deepEqual(readLocalTemplates(memoryStorage('{"other":[]}')), []);
  assert.deepEqual(readLocalTemplates(memoryStorage('null')), []);
});

test('migra el formato legado id/name/type/nodes/edges', () => {
  const storage = memoryStorage(JSON.stringify([{ id: 'legacy', name: 'Legado', type: 'flow', nodes: fixture().nodes, edges: fixture().edges }]));
  const [template] = readLocalTemplates(storage);
  assert.equal(template.schemaVersion, 1);
  assert.equal(template.id, 'legacy');
  assert.equal(template.nodes.length, 2);
  assert.equal(template.edges.length, 1);
  assert.deepEqual(template.groups, []);
});

test('aplica contenido con IDs nuevos y remapea referencias, sin modificar identidad/historial destino', () => {
  const source = fixture();
  const template = createLocalTemplate(source);
  const destination = normalizeProject({ id: 'destination', name: 'Proyecto destino', type: 'old', updated: 1234,
    nodes: [{ id: 'old-node', label: 'Viejo', detail: '', x: 0, y: 0, tone: 'blue' }],
    history: [{ id: 'op1', at: 'now', type: 'edit', summary: 'Conservar' }],
  });
  const applied = applyLocalTemplate(destination, template);
  assert.equal(applied.id, destination.id);
  assert.equal(applied.name, destination.name);
  assert.equal(applied.updated, destination.updated);
  assert.deepEqual(applied.history, destination.history);
  assert.equal(applied.type, template.type);
  assert.notEqual(applied.nodes[0].id, template.nodes[0].id);
  assert.notEqual(applied.edges[0].id, template.edges[0].id);
  const newNodeIds = new Set(applied.nodes.map((n) => n.id));
  const newEdgeIds = new Set(applied.edges.map((e) => e.id));
  assert.equal(newNodeIds.has(applied.edges[0].from), true);
  assert.equal(newNodeIds.has(applied.groups[0].nodeIds[0]), true);
  assert.equal(newNodeIds.has(applied.pages[0].nodeIds[0]), true);
  assert.equal(newEdgeIds.has(applied.pages[0].edgeIds[0]), true);
  assert.equal(newNodeIds.has(applied.sources[0].nodeIds![0]), true);
  assert.equal(newEdgeIds.has(applied.sources[0].edgeIds![0]), true);
  assert.deepEqual(applied.data, template.data);
  assert.equal('history' in template, false);
  assert.equal(LOCAL_TEMPLATES_STORAGE_KEY.length > 0, true);
});

test('rechaza excesos en cantidad y contenido de esquema', () => {
  const template = createLocalTemplate(fixture());
  assert.throws(() => writeLocalTemplates(Array.from({ length: 101 }, (_, i) => ({ ...template, id: `t${i}` })), memoryStorage()), /inválidas/);
  assert.equal(isLocalTemplate({ ...template, nodes: [{ id: 'x' }] }), false);
});
