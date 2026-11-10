export const MAX_WEB_SOURCE_BYTES = 1_048_576;
const tooLargeMessage = (maxBytes: number) => `La fuente web supera ${maxBytes === MAX_WEB_SOURCE_BYTES ? '1 MB' : `${maxBytes} bytes`}; pega un fragmento más corto para mantener el análisis local ligero.`;

export async function readBoundedTextResponse(response: Response, maxBytes = MAX_WEB_SOURCE_BYTES): Promise<string> {
  if (!response.ok) throw new Error('La URL respondió con un error.');
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!(contentType.startsWith('text/') || contentType === 'application/xhtml+xml' || contentType === 'application/json')) {
    throw new Error('La URL no entregó HTML o texto legible; pega aquí su contenido para analizarlo.');
  }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(tooLargeMessage(maxBytes));

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error(tooLargeMessage(maxBytes));
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error(tooLargeMessage(maxBytes));
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
