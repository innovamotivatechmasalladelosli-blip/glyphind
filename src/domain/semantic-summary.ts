export function splitSummarySentences(value: string): string[] {
  return (value.match(/[^.!?]+[.!?]+(?:["'”’)]*)|[^.!?]+$/gu) ?? [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24)
    .slice(0, 20);
}

export function selectSemanticSentences(sentences: string[], scores: number[], limit = 2): string[] {
  if (sentences.length !== scores.length || !Number.isFinite(limit) || limit < 1) return [];
  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: scores[index] }))
    .filter((item) => item.sentence.trim().length >= 24 && Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: typeof ranked = [];
  const seen = new Set<string>();
  for (const item of ranked) {
    const key = item.sentence.toLocaleLowerCase('es-MX').replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue;
    selected.push(item);
    seen.add(key);
    if (selected.length >= Math.floor(limit)) break;
  }
  return selected.sort((a, b) => a.index - b.index).map((item) => item.sentence);
}
