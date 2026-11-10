import assert from 'node:assert/strict';
import test from 'node:test';
import { FormatAdapterRegistry, formatAdapterRegistry } from './format-adapters';
import { normalizeProject } from './model';

test('adapters integrados enrutan Mermaid/Markdown/Excalidraw y conservan parse/serialize', () => {
  const mermaid = formatAdapterRegistry.byExtension('.mmd');
  assert.ok(mermaid?.parse && mermaid.serialize);
  assert.equal(mermaid.parse('flowchart LR\na[A] --> b[B]', 'x.mmd').nodes.length, 2);
  assert.equal(formatAdapterRegistry.byExtension('md')?.parse?.('# Título', 'x.md').data?.document, '# Título');
  assert.equal(formatAdapterRegistry.byExtension('excalidraw')?.serialize?.(normalizeProject({ id: 'x', name: 'X' })).includes('excalidraw'), true);
});

test('registro valida extensiones, rechaza colisiones por operación y permite retirar adapter', () => {
  const registry = new FormatAdapterRegistry();
  const dispose = registry.register({ id: 'demo', name: 'Demo', extensions: ['demo'], mime: 'text/plain', parse: (source) => normalizeProject({ id: 'd', name: source }) });
  assert.equal(registry.byExtension('.DEMO')?.parse?.('A', 'a.demo').name, 'A');
  assert.throws(() => registry.register({ id: 'bad', name: 'Bad', extensions: ['demo'], mime: 'text/plain', parse: (source) => normalizeProject({ id: 'b', name: source }) }), /ya tiene/i);
  assert.throws(() => registry.register({ id: 'evil', name: 'Evil', extensions: ['js;alert(1)'], mime: 'text/plain', parse: () => normalizeProject({ id: 'e' }) }), /inválido/i);
  dispose();
  assert.equal(registry.byExtension('demo'), undefined);
});
