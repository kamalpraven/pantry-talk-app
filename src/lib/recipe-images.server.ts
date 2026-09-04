/**
 * Server-only helper: finds a photo for a web-discovered recipe by reading the
 * recipe page's own social preview image (og:image / twitter:image / etc.).
 */

const cache = new Map<string, string>();

const PATTERNS: RegExp[] = [
  /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url|:url)?["']/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  /"image"\s*:\s*"(https:\/\/[^"']+?\.(?:jpg|jpeg|png|webp)[^"']*)"/i,
  /<img[^>]+src=["'](https:\/\/[^"']+?\.(?:jpg|jpeg|png|webp)[^"']*)["']/i,
];

const BAD = /(sprite|logo|icon|avatar|placeholder|1x1|pixel|blank)/i;

function absolute(candidate: string, pageUrl: string): string | null {
  try {
    const url = new URL(candidate.replace(/&amp;/g, "&"), pageUrl);
    if (url.protocol !== "https:") return null;
    if (BAD.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchPreviewImage(pageUrl: string): Promise<string | null> {
  const cached = cache.get(pageUrl);
  if (cached !== undefined) return cached || null;

  try {
    const response = await fetch(pageUrl, {
      headers: {
        // Some recipe sites serve a stripped page to unknown clients.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      cache.set(pageUrl, "");
      return null;
    }
    const html = (await response.text()).slice(0, 400_000);
    for (const pattern of PATTERNS) {
      const match = pattern.exec(html);
      if (match?.[1]) {
        const resolved = absolute(match[1], response.url || pageUrl);
        if (resolved) {
          cache.set(pageUrl, resolved);
          return resolved;
        }
      }
    }
  } catch {
    /* ignore — the caller falls back to a bundled photo */
  }
  cache.set(pageUrl, "");
  return null;
}

/**
 * Resolves preview photos for a batch of recipe page URLs, a few at a time.
 * Returns a map of page URL to image URL for the ones that were found.
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
