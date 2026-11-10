import assert from 'node:assert/strict';
import test from 'node:test';
import { readTextViaUrlProxy } from './url-proxy-client';

test('envía únicamente la URL y excluye credenciales y referer', async () => {
  let captured: { url: string; init?: RequestInit } | undefined;
  const result = await readTextViaUrlProxy('https://example.com/article', 'https://proxy.example/read', async (input, init) => {
    captured = { url: String(input), init };
    return new Response('<h1>Contenido local</h1>', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  });
  assert.equal(result, '<h1>Contenido local</h1>');
  assert.equal(captured?.url, 'https://proxy.example/read');
  assert.deepEqual(JSON.parse(String(captured?.init?.body)), { url: 'https://example.com/article' });
  assert.equal(captured?.init?.credentials, 'omit');
  assert.equal(captured?.init?.referrerPolicy, 'no-referrer');
});

test('propaga errores del Worker y rechaza respuestas que superan 1 MB', async () => {
  await assert.rejects(
    readTextViaUrlProxy('https://example.com/', 'https://proxy.example/read', async () => Response.json({ error: 'Límite temporal' }, { status: 429 })),
    /Límite temporal/,
  );
  await assert.rejects(
    readTextViaUrlProxy('https://example.com/', 'https://proxy.example/read', async () => new Response('x'.repeat(1_048_577))),
    /supera el límite de 1 MB/,
  );
});

test('el timeout también cubre la lectura del cuerpo del proxy', async () => {
  await assert.rejects(
    readTextViaUrlProxy('https://example.com/', 'https://proxy.example/read', async (_input, init) => {
      const signal = init?.signal as AbortSignal;
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
        },
      }));
    }, 20),
    /superó el límite de 1 segundo/,
  );
});
