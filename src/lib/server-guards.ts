/**
 * Server-only guards for the public API routes.
 *
 * These are stopgaps until the app has real accounts. They stop casual abuse
 * (another site embedding our endpoints, a script looping on them) but a
 * determined attacker can still spoof headers — per-user auth is the real fix.
 */

/* ------------------------------ origin check ------------------------------ */

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True when the request was made by a page served from this app. Browsers
 * always send Origin on POST fetches; Referer is a fallback. Extra allowed
 * origins (e.g. a custom domain behind a proxy) can be listed comma-separated
 * in ALLOWED_ORIGINS.
 */
export function isSameOrigin(request: Request): boolean {
  const caller = hostOf(request.headers.get("origin")) ?? hostOf(request.headers.get("referer"));
  if (!caller) return false;

  const allowed = new Set<string>();
  const own = hostOf(request.url);
  if (own) allowed.add(own);
  const forwarded = request.headers.get("x-forwarded-host");
  if (forwarded) allowed.add(forwarded.split(",")[0]!.trim().toLowerCase());
  for (const entry of (process.env["ALLOWED_ORIGINS"] ?? "").split(",")) {
    const host = hostOf(entry.trim()) ?? (entry.trim().toLowerCase() || null);
    if (host) allowed.add(host);
  }
  return allowed.has(caller);
}

/* ------------------------------- rate limit ------------------------------- */

/**
 * Sliding-window limiter kept in memory. On serverless hosts each instance
 * keeps its own counts, so the effective limit is looser than configured —
 * still enough to stop a single client looping on a paid API.
 */
const hits = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 5_000;

export function clientKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function rateLimit(bucket: string, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const id = `${bucket}:${key}`;
  const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(id, recent);
    return false;
  }
  recent.push(now);
  hits.set(id, recent);

  if (hits.size > MAX_TRACKED_KEYS) {
    // Drop the oldest entries so memory stays bounded.
    const excess = hits.size - MAX_TRACKED_KEYS;
    let removed = 0;
    for (const k of hits.keys()) {
      hits.delete(k);
      removed += 1;
      if (removed >= excess) break;
    }
  }
  return true;
}

/** Shared pre-flight for paid endpoints. Returns a Response to send, or null to proceed. */
export function guardPaidEndpoint(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): Response | null {
  if (!isSameOrigin(request)) {
    return new Response("Requests must come from the Pantry Talk app.", { status: 403 });
  }
  if (!rateLimit(bucket, clientKey(request), limit, windowMs)) {
    return new Response("Too many requests right now — try again in a few minutes.", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) },
    });
  }
  return null;
}

/* ----------------------------- outbound URLs ------------------------------ */

const PRIVATE_HOST =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+|\[.*\])$/i;

/**
 * Only public https hosts may be fetched by the server. Blocks loopback,
 * private ranges, link-local (cloud metadata) and any IPv6 literal.
 */
export function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.port && url.port !== "443") return false;
    return !PRIVATE_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

/* ------------------------------ URL signing ------------------------------- */

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function signingSecret(): string | null {
  // Prefer a dedicated secret; fall back to deriving one from an existing
  // server-only key so the proxy works without new configuration.
  const dedicated = process.env["IMAGE_PROXY_SECRET"];
  if (dedicated) return dedicated;
  const linkup = process.env["LINKUP_API_KEY"];
  return linkup ? `recipe-image:${linkup}` : null;
}

async function hmacKey(): Promise<CryptoKey | null> {
  const secret = signingSecret();
  if (!secret) return null;
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
  return keyPromise;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signValue(value: string): Promise<string | null> {
  const key = await hmacKey();
  if (!key) return null;
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toHex(mac).slice(0, 32);
}

export async function verifySignature(value: string, signature: string): Promise<boolean> {
  const expected = await signValue(value);
  if (!expected || expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/** App-relative proxy path for a remote image, or null if it can't be signed. */
export async function signedImagePath(imageUrl: string): Promise<string | null> {
  if (!isPublicHttpsUrl(imageUrl)) return null;
  const sig = await signValue(imageUrl);
  if (!sig) return null;
  return `/api/public/recipe-image?url=${encodeURIComponent(imageUrl)}&sig=${sig}`;
}
