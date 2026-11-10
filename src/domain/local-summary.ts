const summaryStopWords = new Set('a al con como de del el en es esta la las los más o para por que se su un una y'.split(' '));

function contentWords(value: string) {
  return value.toLocaleLowerCase('es-MX').match(/[\p{L}]{4,}/gu)?.filter((word) => !summaryStopWords.has(word)) ?? [];
}

export function selectGroundedSummary(output: string, source: string): string | null {
  const cleaned = output
    .replace(/^\s*(?:texto|resumen|respuesta|summary)(?:\s+en\s+español)?\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;

  const sourceWords = new Set(contentWords(source));
  const candidates = cleaned.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length >= 25);
  const grounded = candidates.filter((sentence) => {
    const words = contentWords(sentence);
    if (words.length < 4) return false;
    const overlap = new Set(words.filter((word) => sourceWords.has(word)).map((word) => word));
    return overlap.size / new Set(words).size >= 0.35;
  });

  return grounded.slice(0, 2).join(' ') || null;
}
