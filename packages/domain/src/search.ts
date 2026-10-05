/**
 * Instant menu search with typo tolerance. Small catalogs (≈ 120 products) are searched entirely
 * in memory on the client; the API exposes the same function for native apps.
 */

export interface SearchDocument {
  id: string;
  name: string;
  nameZh: string | null;
  description: string | null;
  ingredients: readonly string[];
  categoryName: string;
  posCode: string | null;
}

export interface SearchHit {
  id: string;
  score: number;
  matchedIn: "name" | "ingredient" | "category" | "description" | "code";
}

const STOPWORDS = new Set([
  "di",
  "con",
  "e",
  "al",
  "alla",
  "alle",
  "ai",
  "del",
  "della",
  "in",
  "la",
  "il",
  "lo",
  "le",
  "i",
  "gli",
  "a",
  "da",
]);

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`´]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** Optimal string alignment distance (Damerau–Levenshtein with adjacent transpositions). */
export function editDistance(a: string, b: string, limit = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) d[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > limit) return limit + 1;
  }
  return d[a.length]![b.length]!;
}

/** Score of a query token against a document token (0 = no match). */
function tokenScore(query: string, candidate: string): number {
  if (candidate === query) return 1;
  if (candidate.startsWith(query)) return query.length >= 2 ? 0.9 : 0.5;
  if (query.length >= 4 && candidate.includes(query)) return 0.7;
  // Typo tolerance grows with word length: 1 edit from 4 letters, 2 edits from 7.
  const allowed = query.length >= 7 ? 2 : query.length >= 4 ? 1 : 0;
  if (allowed === 0) return 0;
  const prefix = candidate.slice(0, Math.max(query.length, Math.min(candidate.length, query.length + 1)));
  const dist = Math.min(editDistance(query, candidate, allowed), editDistance(query, prefix, allowed));
  if (dist <= allowed) return 0.6 - dist * 0.1;
  return 0;
}

interface IndexedDocument {
  id: string;
  fields: { field: SearchHit["matchedIn"]; weight: number; tokens: string[] }[];
  zh: string;
}

export function buildSearchIndex(docs: readonly SearchDocument[]): IndexedDocument[] {
  return docs.map((d) => ({
    id: d.id,
    zh: d.nameZh ?? "",
    fields: [
      { field: "name", weight: 3, tokens: tokenize(d.name) },
      { field: "ingredient", weight: 2, tokens: d.ingredients.flatMap(tokenize) },
      { field: "category", weight: 1.5, tokens: tokenize(d.categoryName) },
      { field: "description", weight: 1, tokens: tokenize(d.description ?? "") },
      { field: "code", weight: 2.5, tokens: d.posCode ? [normalizeText(d.posCode)] : [] },
    ],
  }));
}

/**
 * Every query token must match somewhere (AND semantics), so "ravioli gamberi" narrows results.
 * Chinese queries match the Chinese product name directly.
 */
export function searchIndex(index: readonly IndexedDocument[], query: string, limit = 50): SearchHit[] {
  const raw = query.trim();
  if (!raw) return [];
  const hasCjk = /[㐀-鿿]/.test(raw);
  const qTokens = tokenize(raw);
  const hits: SearchHit[] = [];

  for (const doc of index) {
    if (hasCjk) {
      if (doc.zh.includes(raw)) hits.push({ id: doc.id, score: 3, matchedIn: "name" });
      continue;
    }
    if (qTokens.length === 0) continue;
    let total = 0;
    let best: { field: SearchHit["matchedIn"]; score: number } | null = null;
    let allMatched = true;
    for (const q of qTokens) {
      let tokenBest = 0;
      let tokenField: SearchHit["matchedIn"] = "name";
      for (const f of doc.fields) {
        for (const t of f.tokens) {
          const s = tokenScore(q, t) * f.weight;
          if (s > tokenBest) {
            tokenBest = s;
            tokenField = f.field;
          }
        }
      }
      if (tokenBest === 0) {
        allMatched = false;
        break;
      }
      total += tokenBest;
      if (!best || tokenBest > best.score) best = { field: tokenField, score: tokenBest };
    }
    if (allMatched && best) hits.push({ id: doc.id, score: total / qTokens.length, matchedIn: best.field });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function searchCatalog(docs: readonly SearchDocument[], query: string, limit = 50): SearchHit[] {
  return searchIndex(buildSearchIndex(docs), query, limit);
}
