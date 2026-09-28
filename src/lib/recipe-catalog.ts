import { RECIPE_CATALOG, type RecipeCatalogEntry } from '@/data/recipe-catalog.generated';

const PANTRY_STAPLES = new Set([
  'water',
  'salt',
  'black pepper',
  'pepper',
  'olive oil',
  'vegetable oil',
  'oil',
]);

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(recipe|style|easy|classic|homemade|best|fresh|large|small|medium)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function singularish(value: string) {
  const n = normalizeText(value);
  if (n.endsWith('ies') && n.length > 4) return `${n.slice(0, -3)}y`;
  if (n.endsWith('oes') && n.length > 4) return n.slice(0, -2);
  if (n.endsWith('s') && !n.endsWith('ss') && n.length > 3) return n.slice(0, -1);
  return n;
}

function tokens(value: string) {
  return new Set(normalizeText(value).split(' ').filter((token) => token.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

const exact = new Map<string, RecipeCatalogEntry>();
for (const entry of RECIPE_CATALOG) exact.set(normalizeText(entry.name), entry);

export function findCatalogRecipe(title: string): RecipeCatalogEntry | null {
  const normalized = normalizeText(title);
  const direct = exact.get(normalized);
  if (direct) return direct;
  if (!normalized || (RECIPE_CATALOG.length as number) === 0) return null;

  const queryTokens = tokens(normalized);
  let best: RecipeCatalogEntry | null = null;
  let bestScore = 0;

  for (const entry of RECIPE_CATALOG) {
    const candidate = normalizeText(entry.name);
    const contains = candidate.includes(normalized) || normalized.includes(candidate);
    const score = contains ? 0.9 : jaccard(queryTokens, tokens(candidate));
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore >= 0.72 ? best : null;
}

function ingredientMatchesPantry(ingredient: string, pantry: string[]) {
  const ingredientNorm = singularish(ingredient);
  if (!ingredientNorm) return false;
  if (PANTRY_STAPLES.has(ingredientNorm)) return true;

  return pantry.some((raw) => {
    const pantryNorm = singularish(raw);
    if (!pantryNorm) return false;
    if (pantryNorm === ingredientNorm) return true;
    if (pantryNorm.includes(ingredientNorm) || ingredientNorm.includes(pantryNorm)) return true;
    const a = tokens(pantryNorm);
    const b = tokens(ingredientNorm);
    return jaccard(a, b) >= 0.6;
  });
}

export type CatalogCandidate = {
  entry: RecipeCatalogEntry;
  matched: string[];
  missing: string[];
  matchPercent: number;
  score: number;
};

/**
 * Rank the ingredient-rich local catalog before any web discovery.
 * The score strongly rewards recipes that use several pantry items and penalizes
 * recipes that require a large shopping trip.
 */
export function findCatalogCandidates(pantry: string[], limit = 10): CatalogCandidate[] {
  const pantryClean = pantry.map((item) => normalizeText(item)).filter(Boolean);
  if (!pantryClean.length) return [];

  const candidates: CatalogCandidate[] = [];
  for (const entry of RECIPE_CATALOG) {
    if (!entry.ingredients || entry.ingredients.length < 2) continue;

    const meaningful = entry.ingredients.filter(
      (ingredient) => !PANTRY_STAPLES.has(singularish(ingredient)),
    );
    if (!meaningful.length) continue;

    const matched = meaningful.filter((ingredient) => ingredientMatchesPantry(ingredient, pantryClean));
    if (!matched.length) continue;
    const missing = meaningful.filter((ingredient) => !ingredientMatchesPantry(ingredient, pantryClean));
    const matchPercent = Math.round((matched.length / meaningful.length) * 100);

    // Several pantry hits matter more than a superficially high percentage on a tiny recipe.
    const score = matched.length * 5 + matchPercent / 12 - Math.min(missing.length, 8) * 0.6;
    candidates.push({ entry, matched, missing, matchPercent, score });
  }

  return candidates
    .sort((a, b) => {
      if (b.matched.length !== a.matched.length) return b.matched.length - a.matched.length;
      if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
      return b.score - a.score;
    })
    .slice(0, Math.max(1, limit));
}

export function recipeCatalogSize() {
  return RECIPE_CATALOG.length;
}
