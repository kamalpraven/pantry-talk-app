import { RECIPE_CATALOG, type RecipeCatalogEntry } from '@/data/recipe-catalog.generated';

function normalizeTitle(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(recipe|style|easy|classic|homemade|best)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokens(value: string) {
  return new Set(normalizeTitle(value).split(' ').filter((token) => token.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

const exact = new Map<string, RecipeCatalogEntry>();
for (const entry of RECIPE_CATALOG) exact.set(normalizeTitle(entry.name), entry);

/**
 * Find a vetted local catalog image for a discovered recipe.
 * Exact matches win. Fuzzy matches require strong token overlap so an image is
 * omitted rather than showing the wrong dish.
 */
export function findCatalogRecipe(title: string): RecipeCatalogEntry | null {
  const normalized = normalizeTitle(title);
  const direct = exact.get(normalized);
  if (direct) return direct;
  if (!normalized || (RECIPE_CATALOG.length as number) === 0) return null;

  const queryTokens = tokens(normalized);
  let best: RecipeCatalogEntry | null = null;
  let bestScore = 0;

  for (const entry of RECIPE_CATALOG) {
    const candidate = normalizeTitle(entry.name);
    // Strong containment is acceptable for minor suffixes such as "Chicken Curry with Rice".
    const contains = candidate.includes(normalized) || normalized.includes(candidate);
    const score = contains ? 0.9 : jaccard(queryTokens, tokens(candidate));
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore >= 0.72 ? best : null;
}

export function recipeCatalogSize() {
  return RECIPE_CATALOG.length;
}
