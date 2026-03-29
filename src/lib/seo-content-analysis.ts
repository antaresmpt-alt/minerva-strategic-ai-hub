/** Cuenta apariciones no solapadas de `keyword` en `text` (insensible a mayúsculas). */
export function countKeywordOccurrences(text: string, keyword: string): number {
  const k = keyword.trim().toLowerCase();
  if (!k) return 0;
  const t = text.toLowerCase();
  let count = 0;
  let pos = 0;
  while (pos < t.length) {
    const i = t.indexOf(k, pos);
    if (i === -1) break;
    count += 1;
    pos = i + Math.max(1, k.length);
  }
  return count;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/** Palabras por minuto (español, lectura web). */
const WORDS_PER_MINUTE = 200;

export type KeywordDensityStatus = "none" | "low" | "good" | "high";

export type SeoContentAnalysis = {
  wordCount: number;
  keywordOccurrences: number;
  densityPercent: number;
  densityStatus: KeywordDensityStatus;
  readingMinutes: number;
  meetsMinimumWords: boolean;
};

/**
 * Densidad = apariciones de la clave / total de palabras × 100.
 * Objetivo orientativo 1–3 %; &gt;3 % se considera riesgo de keyword stuffing.
 */
export function analyzeSeoContent(
  text: string,
  keyword: string
): SeoContentAnalysis {
  const wordCount = countWords(text);
  const keywordOccurrences = countKeywordOccurrences(text, keyword);
  const densityPercent =
    wordCount > 0 ? (keywordOccurrences / wordCount) * 100 : 0;

  let densityStatus: KeywordDensityStatus = "none";
  if (!keyword.trim()) {
    densityStatus = "none";
  } else if (keywordOccurrences === 0) {
    densityStatus = "low";
  } else if (densityPercent > 3) {
    densityStatus = "high";
  } else if (densityPercent >= 1) {
    densityStatus = "good";
  } else {
    densityStatus = "low";
  }

  const readingMinutes =
    wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));

  return {
    wordCount,
    keywordOccurrences,
    densityPercent,
    densityStatus,
    readingMinutes,
    meetsMinimumWords: wordCount >= 300,
  };
}
