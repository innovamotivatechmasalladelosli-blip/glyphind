import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoundedTextResponse } from './source-read';

test('lee HTML/texto y rechaza respuestas HTTP inválidas o no textuales', async () => {
  assert.equal(await readBoundedTextResponse(new Response('<h1>Fuente</h1>', { headers: { 'content-type': 'text/html' } })), '<h1>Fuente</h1>');
  await assert.rejects(readBoundedTextResponse(new Response('no', { status: 404, headers: { 'content-type': 'text/plain' } })), /respondió con un error/);
  await assert.rejects(readBoundedTextResponse(new Response('binario', { headers: { 'content-type': 'application/pdf' } })), /no entregó HTML o texto/);
});

test('limita bytes declarados y medidos del cuerpo de respuesta', async () => {
  await assert.rejects(readBoundedTextResponse(new Response('x', { headers: { 'content-type': 'text/plain', 'content-length': '100' } }), 10), /supera/);
  await assert.rejects(readBoundedTextResponse(new Response('demasiado largo', { headers: { 'content-type': 'text/plain' } }), 5), /supera/);
});
