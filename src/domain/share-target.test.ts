import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSharedDocument, parseShareTarget } from './share-target';

test('parsea texto y URL compartidos y conserva origen en el documento', () => {
  const params = new URLSearchParams({ title: 'Artículo de prueba', text: 'Fragmento compartido', url: 'https://example.com/articulo?ref=share' });
  const capture = parseShareTarget(`?${params.toString()}`);
  assert.deepEqual(capture, { title: 'Artículo de prueba', text: 'Fragmento compartido', url: 'https://example.com/articulo?ref=share' });
  assert.equal(formatSharedDocument(capture!), '# Artículo de prueba\n\nFragmento compartido\n\nFuente compartida: https://example.com/articulo?ref=share');
});

test('deriva título y URL web del texto cuando la app de origen no manda campos separados', () => {
  const capture = parseShareTarget(`?text=${encodeURIComponent('https://example.org/nota\nUna nota breve')}`);
  assert.equal(capture?.title, 'example.org');
  assert.equal(capture?.url, 'https://example.org/nota');
  assert.equal(capture?.text, 'https://example.org/nota\nUna nota breve');
});

test('ignora esquemas activos y URLs con credenciales, sin descartar el texto compartido', () => {
  assert.equal(parseShareTarget('?url=javascript%3Aalert(1)'), null);
  const capture = parseShareTarget('?text=nota&url=https%3A%2F%2Fuser%3Apass%40example.org');
  assert.equal(capture?.text, 'nota');
  assert.equal(capture?.url, '');
});

test('limita campos compartidos y no crea documentos vacíos', () => {
  assert.equal(parseShareTarget(''), null);
  const capture = parseShareTarget(`?title=${'T'.repeat(220)}&text=${'x'.repeat(25_000)}`);
  assert.equal(capture?.title.length, 160);
  assert.equal(capture?.text.length, 20_000);
});
