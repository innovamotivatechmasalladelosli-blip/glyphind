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

export function selectEnsembleSentences(sentences: string[], relevanceScores: number[], diversityVectors: number[][], limit = 6): string[] {
  if (sentences.length !== relevanceScores.length || sentences.length !== diversityVectors.length || !Number.isFinite(limit) || limit < 1) return [];
  const candidates = sentences.map((sentence, index) => ({ sentence, index, relevance: relevanceScores[index], vector: diversityVectors[index] }))
    .filter((item) => item.sentence.trim().length >= 24 && Number.isFinite(item.relevance) && item.vector.length > 0 && item.vector.every(Number.isFinite));
  if (!candidates.length) return [];
  const selected: typeof candidates = [];
  const seen = new Set<string>();
  while (selected.length < Math.floor(limit) && selected.length < candidates.length) {
    const next = candidates.filter((candidate) => !selected.includes(candidate)).map((candidate) => {
      const key = candidate.sentence.toLocaleLowerCase('es-MX').replace(/\s+/g, ' ').trim();
      const duplicate = seen.has(key);
      const redundancy = selected.length ? Math.max(...selected.map((item) => cosineSimilarity(candidate.vector, item.vector))) : 0;
      const relevance = Math.max(0, Math.min(1, candidate.relevance));
      return { candidate, score: duplicate ? Number.NEGATIVE_INFINITY : relevance * .65 + (1 - Math.max(0, redundancy)) * .35 };
    }).sort((a, b) => b.score - a.score || a.candidate.index - b.candidate.index)[0];
    if (!next || !Number.isFinite(next.score)) break;
    selected.push(next.candidate);
    seen.add(next.candidate.sentence.toLocaleLowerCase('es-MX').replace(/\s+/g, ' ').trim());
  }
  return selected.sort((a, b) => a.index - b.index).map((item) => item.sentence);
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || !left.length) return 0;
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const leftNorm = Math.sqrt(left.reduce((sum, value) => sum + value * value, 0));
  const rightNorm = Math.sqrt(right.reduce((sum, value) => sum + value * value, 0));
  return leftNorm && rightNorm ? dot / (leftNorm * rightNorm) : 0;
}
