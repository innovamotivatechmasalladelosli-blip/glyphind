import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GLYPHIND_APP_ORIGIN,
  handleUrlProxyRequest,
  type ProxyFetch,
  type UrlProxyEnvironment,
} from './url-proxy-handler';

const publicA = '93.184.216.34';
const publicAAAA = '2606:2800:220:1:248:1893:25c8:1946';
const rateAllowed: UrlProxyEnvironment = { URL_PROXY_RATE_LIMIT: { limit: async () => ({ success: true }) } };
const rateBlocked: UrlProxyEnvironment = { URL_PROXY_RATE_LIMIT: { limit: async () => ({ success: false }) } };

function request(url: string, options: { origin?: string; method?: string; path?: string; body?: string } = {}) {
  const method = options.method ?? 'POST';
  return new Request(`https://glyphind-url-reader.example.workers.dev${options.path ?? '/read'}`, {
    method,
    headers: {
      origin: options.origin ?? GLYPHIND_APP_ORIGIN,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
      'cf-connecting-ip': '203.0.113.9',
    },
    ...(method === 'POST' ? { body: options.body ?? JSON.stringify({ url }) } : {}),
  });
}

function dnsResponse(recordType: string, address = recordType === 'A' ? publicA : publicAAAA) {
  const type = recordType === 'A' ? 1 : 28;
  return new Response(JSON.stringify({ Status: 0, Answer: [{ name: 'public.example.org', type, TTL: 300, data: address }] }), {
    headers: { 'content-type': 'application/dns-json' },
  });
}

function fetchForPage(page: (url: URL) => Response = () => new Response('<article>Contenido legible</article>', { headers: { 'content-type': 'text/html; charset=utf-8' } })) {
  const called: string[] = [];
  const dnsRedirects: Array<RequestRedirect | undefined> = [];
  const fetcher: ProxyFetch = async (input, init) => {
    const url = input instanceof URL ? input : typeof input === 'string' ? new URL(input) : new URL(input.url);
    called.push(url.href);
    if (url.hostname === 'cloudflare-dns.com') {
      dnsRedirects.push(init?.redirect);
      return dnsResponse(url.searchParams.get('type') ?? 'A');
    }
    return page(url);
  };
  return { fetcher, called, dnsRedirects };
}

test('lee una página pública sólo desde el origen oficial y devuelve texto plano', async () => {
  const { fetcher, called, dnsRedirects } = fetchForPage();
  const response = await handleUrlProxyRequest(request('https://public.example.org/article'), rateAllowed, fetcher);
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), GLYPHIND_APP_ORIGIN);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-type') ?? '', /^text\/plain/);
  assert.equal(body, '<article>Contenido legible</article>');
  assert.equal(called.filter((url) => url.includes('cloudflare-dns.com')).length, 2);
  assert.deepEqual(dnsRedirects, ['manual', 'manual']);
  assert.equal(called[called.length - 1], 'https://public.example.org/article');
});

test('rechaza origins no permitidos y preflight de otros orígenes', async () => {
  const { fetcher, called } = fetchForPage();
  const post = await handleUrlProxyRequest(request('https://public.example.org/', { origin: 'https://evil.example' }), rateAllowed, fetcher);
  assert.equal(post.status, 403);
  assert.equal(post.headers.get('access-control-allow-origin'), null);
  const preflight = await handleUrlProxyRequest(request('', { origin: 'null', method: 'OPTIONS' }), rateAllowed, fetcher);
  assert.equal(preflight.status, 403);
  assert.equal(called.length, 0);
});

test('rechaza métodos y rutas no admitidos antes de consultar el upstream', async () => {
  const { fetcher, called } = fetchForPage();
  const method = await handleUrlProxyRequest(request('', { method: 'GET' }), rateAllowed, fetcher);
  const path = await handleUrlProxyRequest(request('', { path: '/anything' }), rateAllowed, fetcher);
  assert.equal(method.status, 405);
  assert.equal(path.status, 404);
  assert.equal(called.length, 0);
});

test('bloquea direcciones IP literales, credenciales, esquemas y puertos no estándar', async () => {
  const { fetcher, called } = fetchForPage();
  for (const url of [
    'http://127.0.0.1/',
    'http://2130706433/',
    'http://[::1]/',
    'https://user:pass@public.example.org/',
    'file:///etc/passwd',
    'https://public.example.org:8443/',
    'https://service.local/',
  ]) {
    const response = await handleUrlProxyRequest(request(url), rateAllowed, fetcher);
    assert.ok(response.status >= 400, url);
  }
  assert.equal(called.length, 0);
});

test('rechaza DNS con cualquier respuesta privada y no consulta ese host', async () => {
  const called: string[] = [];
  const fetcher: ProxyFetch = async (input) => {
    const url = input instanceof URL ? input : typeof input === 'string' ? new URL(input) : new URL(input.url);
    called.push(url.href);
    return url.searchParams.get('type') === 'A'
      ? dnsResponse('A', '10.0.0.8')
      : dnsResponse('AAAA', publicAAAA);
  };
  const response = await handleUrlProxyRequest(request('https://public.example.org/article'), rateAllowed, fetcher);
  assert.equal(response.status, 400);
  assert.equal(called.some((url) => url === 'https://public.example.org/article'), false);
});

test('no sigue redirecciones, incluidos saltos hacia destinos privados', async () => {
  const { fetcher, called } = fetchForPage(() => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } }));
  const response = await handleUrlProxyRequest(request('https://public.example.org/article'), rateAllowed, fetcher);
  assert.equal(response.status, 422);
  assert.equal(called.some((url) => url.includes('127.0.0.1')), false);
});

test('acepta sólo tipos textuales y limita el cuerpo descargado a 1 MB', async () => {
  const binary = fetchForPage(() => new Response('pdf', { headers: { 'content-type': 'application/pdf' } }));
  const rejectedType = await handleUrlProxyRequest(request('https://public.example.org/file'), rateAllowed, binary.fetcher);
  assert.equal(rejectedType.status, 415);

  const large = fetchForPage(() => new Response('x'.repeat(1_048_577), { headers: { 'content-type': 'text/plain' } }));
  const rejectedSize = await handleUrlProxyRequest(request('https://public.example.org/large'), rateAllowed, large.fetcher);
  assert.equal(rejectedSize.status, 413);
});

test('aplica rate limit y falla cerrado si no existe la binding', async () => {
  const { fetcher, called } = fetchForPage();
  const blocked = await handleUrlProxyRequest(request('https://public.example.org/'), rateBlocked, fetcher);
  const missingBinding = await handleUrlProxyRequest(request('https://public.example.org/'), {}, fetcher);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '60');
  assert.equal(missingBinding.status, 503);
  assert.equal(called.length, 0);
});
