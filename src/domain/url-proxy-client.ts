export const URL_PROXY_ENDPOINT = 'https://glyphind-url-reader.innovamotivatechmasalladelosli.workers.dev/read';
export const URL_PROXY_CLIENT_MAX_BYTES = 1_048_576;
const MAX_ERROR_BODY_BYTES = 8_192;

export type ProxyClientFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

class ProxyClientError extends Error {}

async function readLimitedText(response: Response, maximumBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new ProxyClientError('La respuesta del proxy supera el límite permitido.');
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maximumBytes) {
        await reader.cancel();
        throw new ProxyClientError('La página supera el límite de 1 MB.');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function readTextViaUrlProxy(
  sourceUrl: string,
  endpoint = URL_PROXY_ENDPOINT,
  fetcher: ProxyClientFetch = fetch,
  timeoutMs = 18_000,
): Promise<string> {
  if (!endpoint) throw new Error('El proxy opcional no está configurado.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: sourceUrl }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await readLimitedText(response, MAX_ERROR_BODY_BYTES);
      let message = 'El proxy no pudo leer esta página.';
      try {
        const payload: unknown = JSON.parse(body);
        if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
          message = payload.error;
        }
      } catch {
        // El mensaje genérico evita mostrar respuestas arbitrarias del servidor.
      }
      throw new ProxyClientError(message);
    }

    const content = await readLimitedText(response, URL_PROXY_CLIENT_MAX_BYTES);
    if (!content.trim()) throw new ProxyClientError('El proxy no devolvió texto para analizar.');
    return content;
  } catch (error) {
    if (controller.signal.aborted) {
      const seconds = Math.max(1, Math.ceil(timeoutMs / 1_000));
      throw new Error(`El proxy superó el límite de ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}.`);
    }
    if (error instanceof ProxyClientError) throw error;
    throw new Error('No se pudo conectar con el proxy opcional de Cloudflare.');
  } finally {
    clearTimeout(timeout);
  }
}
