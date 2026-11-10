export const GLYPHIND_APP_ORIGIN = 'https://innovamotivatechmasalladelosli-blip.github.io';
export const URL_PROXY_MAX_BYTES = 1_048_576;
const MAX_REQUEST_BYTES = 4_096;
const MAX_URL_LENGTH = 2_048;
const MAX_DNS_RESPONSE_BYTES = 32_768;
const UPSTREAM_TIMEOUT_MS = 12_000;
const ACCEPTED_CONTENT_TYPES = new Set([
  'text/html',
  'text/plain',
  'application/xhtml+xml',
  'application/json',
]);
const BLOCKED_SUFFIXES = [
  '.localhost', '.local', '.internal', '.test', '.invalid', '.example', '.home.arpa',
];

export interface UrlProxyRateLimiter {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export interface UrlProxyEnvironment {
  URL_PROXY_RATE_LIMIT?: UrlProxyRateLimiter;
}

export type ProxyFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

class ProxyError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ProxyError';
  }
}

function corsHeaders(origin: string) {
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
}

function jsonResponse(origin: string, status: number, payload: Record<string, unknown>, extraHeaders?: HeadersInit) {
  const headers = corsHeaders(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (extraHeaders) new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(payload), { status, headers });
}

function textResponse(origin: string, content: string) {
  const headers = corsHeaders(origin);
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  return new Response(content, { status: 200, headers });
}

function ipv4Octets(address: string): number[] | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) return null;
  const octets = address.split('.').map(Number);
  return octets.every((part) => part >= 0 && part <= 255) ? octets : null;
}

function isPublicIpv4(address: string): boolean {
  const octets = ipv4Octets(address);
  if (!octets) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 192 && b === 2) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a === 255 && b === 255 && c === 255) return false;
  return true;
}

function parseIpv6(address: string): number[] | null {
  let value = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (!value.includes(':')) return null;
  if (value.includes('.')) {
    const separator = value.lastIndexOf(':');
    const embedded = ipv4Octets(value.slice(separator + 1));
    if (!embedded) return null;
    const first = ((embedded[0] << 8) | embedded[1]).toString(16);
    const second = ((embedded[2] << 8) | embedded[3]).toString(16);
    value = `${value.slice(0, separator + 1)}${first}:${second}`;
  }
  const halves = value.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (left.some((part) => !/^[\da-f]{1,4}$/.test(part)) || right.some((part) => !/^[\da-f]{1,4}$/.test(part))) return null;
  if ((halves.length === 1 && left.length !== 8) || (halves.length === 2 && left.length + right.length >= 8)) return null;
  const groups = halves.length === 1
    ? left
    : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return groups.map((part) => Number.parseInt(part, 16));
}

function isPublicIpv6(address: string): boolean {
  const groups = parseIpv6(address);
  if (!groups) return false;
  const first = groups[0];
  // Only global-unicast 2000::/3 is accepted. Exclude protocol, documentation and relay ranges.
  if (first < 0x2000 || first > 0x3fff) return false;
  if (first === 0x2001 && (groups[1] <= 0x01ff || groups[1] === 0x0db8)) return false;
  if (first === 0x2002) return false;
  return true;
}

function isPublicAddress(address: string): boolean {
  return address.includes(':') ? isPublicIpv6(address) : isPublicIpv4(address);
}

function parsePublicHttpUrl(rawUrl: unknown): URL {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > MAX_URL_LENGTH) {
    throw new ProxyError(400, 'La URL no es válida o supera el límite de 2 KB.');
  }
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new ProxyError(400, 'La URL no tiene un formato válido.');
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new ProxyError(400, 'Sólo se admiten direcciones HTTP y HTTPS.');
  }
  if (target.username || target.password) {
    throw new ProxyError(400, 'No se admiten credenciales dentro de la URL.');
  }
  if (target.port && target.port !== (target.protocol === 'https:' ? '443' : '80')) {
    throw new ProxyError(400, 'Sólo se admiten los puertos web estándar 80 y 443.');
  }
  const hostname = target.hostname.toLowerCase().replace(/\.$/, '');
  if (hostname.startsWith('[') || ipv4Octets(hostname) || hostname === 'localhost' || BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new ProxyError(400, 'No se admiten direcciones IP ni nombres de red local.');
  }
  const labels = hostname.split('.');
  if (hostname.length > 253 || labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || /^\d+$/.test(labels[labels.length - 1] ?? '')) {
    throw new ProxyError(400, 'Sólo se admiten nombres de dominio públicos válidos.');
  }
  target.hash = '';
  return target;
}

async function readStreamLimited(stream: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string> {
  if (!stream) return '';
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > maxBytes) {
        await reader.cancel();
        throw new ProxyError(413, `El contenido de la página supera el límite de ${Math.floor(maxBytes / 1_048_576)} MB.`);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function readRequestJson(request: Request): Promise<{ url?: unknown }> {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') throw new ProxyError(415, 'La solicitud debe usar application/json.');
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) throw new ProxyError(413, 'La solicitud es demasiado grande.');
  const raw = await readStreamLimited(request.body, MAX_REQUEST_BYTES);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    return parsed as { url?: unknown };
  } catch {
    throw new ProxyError(400, 'El cuerpo de la solicitud no contiene JSON válido.');
  }
}

async function verifyPublicDns(hostname: string, fetcher: ProxyFetch, signal: AbortSignal): Promise<void> {
  const dnsResponses = await Promise.all(['A', 'AAAA'].map(async (recordType) => {
    const url = new URL('https://cloudflare-dns.com/dns-query');
    url.searchParams.set('name', hostname);
    url.searchParams.set('type', recordType);
    let response: Response;
    try {
      response = await fetcher(url, { headers: { Accept: 'application/dns-json' }, redirect: 'manual', cache: 'no-store', signal });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'error desconocido';
      throw new ProxyError(503, `No se pudo verificar que el dominio sea público (${reason}).`);
    }
    if (!response.ok) throw new ProxyError(503, `El resolver DNS respondió con HTTP ${response.status}.`);
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_DNS_RESPONSE_BYTES) throw new ProxyError(502, 'La verificación DNS devolvió una respuesta inesperada.');
    const raw = await readStreamLimited(response.body, MAX_DNS_RESPONSE_BYTES);
    try {
      return JSON.parse(raw) as { Status?: number; Answer?: Array<{ type?: number; data?: string }> };
    } catch {
      throw new ProxyError(502, 'La verificación DNS devolvió una respuesta ilegible.');
    }
  }));
  const answers = dnsResponses.flatMap((result) => result.Status === 0 ? (result.Answer ?? []) : []);
  const addresses = answers.filter((answer) => answer.type === 1 || answer.type === 28).map((answer) => answer.data ?? '');
  if (addresses.length === 0) throw new ProxyError(422, 'El dominio no tiene una dirección pública verificable.');
  if (addresses.some((address) => !isPublicAddress(address))) {
    throw new ProxyError(400, 'El dominio resuelve a una dirección no pública y se bloqueó por seguridad.');
  }
}

async function readPageText(target: URL, fetcher: ProxyFetch, signal: AbortSignal): Promise<{ content: string; contentType: string }> {
  let response: Response;
  try {
    response = await fetcher(target, {
      method: 'GET',
      headers: { Accept: 'text/html, text/plain, application/xhtml+xml, application/json;q=0.9' },
      redirect: 'manual',
      cache: 'no-store',
      signal,
    });
  } catch {
    throw new ProxyError(502, 'El sitio no respondió a la solicitud del proxy.');
  }
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new ProxyError(422, 'El sitio redirigió la solicitud. Abre la URL final en el navegador y vuelve a intentarlo.');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new ProxyError(502, 'El sitio respondió con un error o requiere acceso.');
  }
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!ACCEPTED_CONTENT_TYPES.has(contentType)) {
    await response.body?.cancel();
    throw new ProxyError(415, 'El sitio no entregó HTML o texto legible.');
  }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > URL_PROXY_MAX_BYTES) {
    await response.body?.cancel();
    throw new ProxyError(413, 'La página supera el límite de 1 MB.');
  }
  return { content: await readStreamLimited(response.body, URL_PROXY_MAX_BYTES), contentType };
}

export async function handleUrlProxyRequest(request: Request, env: UrlProxyEnvironment, fetcher: ProxyFetch = fetch): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin !== GLYPHIND_APP_ORIGIN) return new Response('Origen no permitido.', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  if (new URL(request.url).pathname !== '/read') return jsonResponse(origin, 404, { error: 'Ruta no encontrada.' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return jsonResponse(origin, 405, { error: 'Método no permitido.' }, { Allow: 'POST, OPTIONS' });
  if (!env.URL_PROXY_RATE_LIMIT) return jsonResponse(origin, 503, { error: 'El control de uso no está disponible.' });

  try {
    const clientKey = request.headers.get('cf-connecting-ip') || 'sin-ip';
    let allowed: boolean;
    try {
      allowed = (await env.URL_PROXY_RATE_LIMIT.limit({ key: clientKey })).success;
    } catch {
      throw new ProxyError(503, 'El control de uso no respondió. Inténtalo más tarde.');
    }
    if (!allowed) throw new ProxyError(429, 'Alcanzaste el límite temporal de lecturas. Espera un minuto e inténtalo otra vez.');

    const body = await readRequestJson(request);
    const target = parsePublicHttpUrl(body.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      await verifyPublicDns(target.hostname, fetcher, controller.signal);
      const page = await readPageText(target, fetcher, controller.signal);
      return textResponse(origin, page.content);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new ProxyError(504, 'La lectura superó el límite de 12 segundos.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const failure = error instanceof ProxyError ? error : new ProxyError(500, 'No se pudo leer esta página.');
    return jsonResponse(origin, failure.status, { error: failure.message }, failure.status === 429 ? { 'Retry-After': '60' } : undefined);
  }
}
