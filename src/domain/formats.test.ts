import assert from 'node:assert/strict';
import test from 'node:test';
import { exportExcalidraw, exportMermaid, importExcalidraw, importMarkdown, importMermaid, readFormatPlugins, writeFormatPlugins, type FormatPlugin } from './formats';
import { normalizeProject } from './model';

test('importa nodos, direcciones y etiquetas de un flowchart Mermaid', () => {
  const project = importMermaid('flowchart LR\n  start([Inicio]) -->|continúa| decision{¿Listo?}\n  decision --> finish[Fin]', 'Proceso');
  assert.equal(project.name, 'Proceso');
  assert.equal(project.nodes.length, 3);
  assert.equal(project.edges.length, 2);
  assert.equal(project.edges[0].label, 'continúa');
  assert.equal(project.edges[0].direction, 'forward');
  assert.equal(project.nodes[0].label, 'Inicio');
});

test('exporta IDs estables y labels con escape seguro', () => {
  const project = normalizeProject({
    id: 'safe', name: 'Seguro', type: 'flow',
    nodes: [{ id: 'a one', label: 'A "idea" <script>alert(1)</script>' }, { id: 'b', label: 'Salida' }],
    edges: [{ id: 'e', from: 'a one', to: 'b', label: 'conecta', direction: 'forward' }],
  });
  const exported = exportMermaid(project);
  assert.match(exported, /^flowchart LR/m);
  assert.match(exported, /a_one\["A \\\"idea\\\"/);
  assert.doesNotMatch(exported, /<script/i);
  assert.match(exported, /\| conecta \|/);
  const roundTrip = importMermaid(exported);
  assert.equal(roundTrip.nodes.length, 2);
  assert.equal(roundTrip.edges.length, 1);
});

test('Mermaid conserva direcciones backward, both y none', () => {
  const project = normalizeProject({ id: 'directions', name: 'Direcciones', type: 'flow', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 'd', label: 'D' }], edges: [{ id: 'back', from: 'a', to: 'b', direction: 'backward' }, { id: 'both', from: 'b', to: 'c', direction: 'both' }, { id: 'none', from: 'c', to: 'd', direction: 'none' }] });
  const exported = exportMermaid(project);
  assert.deepEqual(importMermaid(exported).edges.map((edge) => edge.direction), ['backward', 'both', 'none']);
});

test('rechaza directivas ejecutables o sintaxis desconocida en vez de ignorarlas', () => {
  assert.throws(() => importMermaid('flowchart LR\na-->b\nclick a "javascript:alert(1)"'), /no se importó/i);
});

test('convierte Markdown a un documento editable conservando el original y su procedencia', () => {
  const markdown = '# Plan\n\n## Fase uno\n- Investigar\n- Diseñar\n';
  const project = importMarkdown(markdown, 'plan.md');
  assert.equal(project.type, 'document');
  assert.equal(project.name, 'Plan');
  assert.equal(project.data?.document, markdown);
  assert.equal(project.nodes.length, 4);
  assert.equal(project.sources[0].kind, 'file');
});

test('Markdown ignora fenced code, conserva headings repetidos y limita a 200 nodos', () => {
  const project = importMarkdown('# Título\n```md\n# no importar\n- no importar\n```\n## Repetido\n## Repetido\n- visible');
  assert.deepEqual(project.nodes.map((node) => node.label), ['Título', 'Repetido', 'Repetido', 'visible']);
  assert.throws(() => importMarkdown('```\n# solo código\n```'), /no contiene.*importables/i);
  assert.equal(importMarkdown(Array.from({ length: 205 }, (_, i) => `- elemento ${i}`).join('\n')).nodes.length, 200);
});

test('exporta e importa Excalidraw manteniendo nodos, texto y conectores editables', () => {
  const project = normalizeProject({
    id: 'excalidraw-test', name: 'Mapa', type: 'flow',
    nodes: [{ id: 'start', label: 'Inicio', x: 10, y: 20, shape: 'circle' }, { id: 'finish', label: 'Fin', x: 80, y: 70 }],
    edges: [{ id: 'path', from: 'start', to: 'finish', label: 'continuar', direction: 'forward' }],
  });
  const file = exportExcalidraw(project);
  const parsed = JSON.parse(file);
  assert.equal(parsed.type, 'excalidraw');
  assert.ok(parsed.elements.some((element: { type: string }) => element.type === 'arrow'));
  const restored = importExcalidraw(file, 'mapa.excalidraw');
  assert.equal(restored.nodes.length, 2);
  assert.equal(restored.nodes[0].label, 'Inicio');
  assert.equal(restored.edges.length, 1);
  assert.equal(restored.edges[0].label, 'continuar');
});

test('Excalidraw conserva ambos sentidos y metadatos personalizados de Glyphind', () => {
  const project = normalizeProject({ id: 'meta', name: 'Meta', type: 'flow', nodes: [{ id: 'a', label: 'A', detail: 'detalle', shape: 'hexagon', tone: 'orange', colorHex: '#abc' }, { id: 'b', label: 'B' }], edges: [{ id: 'e', from: 'a', to: 'b', direction: 'both', fromPort: 'bottom', toPort: 'left' }] });
  const restored = importExcalidraw(exportExcalidraw(project));
  assert.equal(restored.edges[0].direction, 'both');
  assert.equal(restored.edges[0].fromPort, 'bottom');
  assert.equal(restored.edges[0].toPort, 'left');
  assert.equal(restored.nodes[0].detail, 'detalle');
  assert.equal(restored.nodes[0].shape, 'hexagon');
  assert.equal(restored.nodes[0].colorHex, '#abc');
});

test('rechaza archivos Excalidraw con esquema desconocido', () => {
  assert.throws(() => importExcalidraw('{"type":"other","elements":[]}'), /Excalidraw válido/i);
});

test('registra descriptores locales de plugins sin ejecutar extensiones inválidas', () => {
  let saved = '';
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
  const plugins: FormatPlugin[] = [{ id: 'markdown-extra', name: 'Markdown alterno', extensions: ['mdx'], kind: 'importer', enabled: true }];
  writeFormatPlugins(plugins, storage);
  assert.deepEqual(readFormatPlugins(storage), [{ ...plugins[0], enabled: false }]);
  saved = '[{"id":"bad","name":"Bad","extensions":["x;alert(1)"],"kind":"importer","enabled":true}]';
  assert.deepEqual(readFormatPlugins(storage), []);
});
