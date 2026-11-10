export type ShareTargetCapture = { title: string; text: string; url: string };

const MAX_TITLE_LENGTH = 160;
const MAX_TEXT_LENGTH = 20_000;
const MAX_URL_LENGTH = 2_048;

function validHttpUrl(value: string) {
  if (!value || value.length > MAX_URL_LENGTH) return '';
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.username && !parsed.password ? value : '';
  } catch {
    return '';
  }
}

export function parseShareTarget(search: string): ShareTargetCapture | null {
  const params = new URLSearchParams(search);
  const rawTitle = (params.get('title') ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
  const text = (params.get('text') ?? '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_TEXT_LENGTH);
  const rawUrl = (params.get('url') ?? '').trim();
  const textUrl = text.match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? '';
  const url = validHttpUrl(rawUrl || textUrl);

  if (!rawTitle && !text && !url) return null;
  const fallbackTitle = url ? new URL(url).hostname : text.split('\n')[0]?.slice(0, 80) ?? '';
  const title = (rawTitle || fallbackTitle || 'Contenido compartido').slice(0, MAX_TITLE_LENGTH);
  return { title, text, url };
}

export function formatSharedDocument(capture: ShareTargetCapture) {
  return [
    `# ${capture.title}`,
    capture.text,
    capture.url ? `Fuente compartida: ${capture.url}` : '',
  ].filter(Boolean).join('\n\n');
}
