/**
 * Server-only helper: resolves a trustworthy hero photo for a web-discovered
 * recipe. Prefer schema.org Recipe JSON-LD; social preview images are only a
 * fallback. We deliberately avoid grabbing arbitrary <img> tags because those
 * are frequently logos, avatars, or social-share art.
 */

const cache = new Map<string, string>();

const META_PATTERNS: RegExp[] = [
  /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url|:url)?["']/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
];

const BAD =
  /(sprite|logo|icon|avatar|placeholder|1x1|pixel|blank|facebook|twitter|instagram|pinterest|youtube|whatsapp|tiktok|linkedin|social|share[-_/]?button)/i;

function absolute(candidate: string, pageUrl: string): string | null {
  try {
    const decoded = candidate.replace(/&amp;/g, "&").trim();
    const url = new URL(decoded, pageUrl);
    if (url.protocol !== "https:") return null;
    // Test the complete URL, not only pathname: CDN/query strings often reveal
    // that an asset is a logo/social image even when the path itself does not.
    if (BAD.test(url.toString())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hasRecipeType(value: unknown): boolean {
  if (typeof value === "string") return value.toLowerCase() === "recipe";
  if (Array.isArray(value)) return value.some(hasRecipeType);
  return false;
}

function imageCandidate(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = imageCandidate(item);
      if (candidate) return candidate;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["url", "contentUrl", "thumbnailUrl"]) {
      if (typeof obj[key] === "string") return obj[key] as string;
    }
  }
  return null;
}

function findRecipeImage(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = findRecipeImage(item);
      if (candidate) return candidate;
    }
    return null;
  }
  if (typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;
  if (hasRecipeType(obj["@type"])) {
    const candidate = imageCandidate(obj["image"] ?? obj["thumbnailUrl"]);
    if (candidate) return candidate;
  }

  // JSON-LD commonly wraps entities in @graph.
  if (obj["@graph"]) {
    const candidate = findRecipeImage(obj["@graph"]);
    if (candidate) return candidate;
  }
  return null;
}

function recipeJsonLdImage(html: string, pageUrl: string): string | null {
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html))) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const candidate = findRecipeImage(parsed);
      if (candidate) {
        const resolved = absolute(candidate, pageUrl);
        if (resolved) return resolved;
      }
    } catch {
      // Some sites emit malformed JSON-LD; continue to other scripts/meta tags.
    }
  }
  return null;
}

async function fetchPreviewImage(pageUrl: string): Promise<string | null> {
  const cached = cache.get(pageUrl);
  if (cached !== undefined) return cached || null;

  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      cache.set(pageUrl, "");
      return null;
    }

    const resolvedPageUrl = response.url || pageUrl;
    const html = (await response.text()).slice(0, 800_000);

    // Strongest signal: structured Recipe data from the recipe page itself.
    const structured = recipeJsonLdImage(html, resolvedPageUrl);
    if (structured) {
      cache.set(pageUrl, structured);
      return structured;
    }

    // Fallback to social preview metadata. Never fall through to a random img.
    for (const pattern of META_PATTERNS) {
      const match = pattern.exec(html);
      if (match?.[1]) {
        const resolved = absolute(match[1], resolvedPageUrl);
        if (resolved) {
          cache.set(pageUrl, resolved);
          return resolved;
        }
      }
    }
  } catch {
    /* ignore — the UI renders a neutral food placeholder */
  }

  cache.set(pageUrl, "");
  return null;
}

/**
 * Resolves hero photos for a batch of recipe page URLs, a few at a time.
 * Returns a map of page URL to image URL only where a credible image exists.
 */
export async function resolveRecipeImages(
  pageUrls: string[],
  concurrency = 5,
): Promise<Record<string, string>> {
  const unique = [...new Set(pageUrls.filter((u) => /^https:\/\//.test(u)))];
  const found: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((url) => fetchPreviewImage(url)));
    results.forEach((result, index) => {
      const url = batch[index];
      if (url && result.status === "fulfilled" && result.value) found[url] = result.value;
    });
  }
  return found;
}
