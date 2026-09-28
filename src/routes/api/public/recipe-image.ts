import { createFileRoute } from "@tanstack/react-router";
import { clientKey, isPublicHttpsUrl, rateLimit, verifySignature } from "@/lib/server-guards";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
/** Per client: a results page shows ~14 photos, so this allows plenty of browsing. */
const LIMIT = 300;
const WINDOW_MS = 10 * 60 * 1000;

/**
 * Image passthrough so recipe photos that block hotlinking still display.
 *
 * Only URLs the server itself signed during recipe discovery are relayed, so
 * this is not an open proxy. Every hop (including redirects) must be a public
 * https host, and only image responses under 5 MB are passed through.
 */
async function fetchImage(start: string): Promise<Response | null> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isPublicHttpsUrl(current)) return null;
    const parsed = new URL(current);
    const response = await fetch(current, {
      headers: {
        Accept: "image/*",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Referer: `${parsed.protocol}//${parsed.host}/`,
      },
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  return null;
}

export const Route = createFileRoute("/api/public/recipe-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const target = params.get("url");
        const sig = params.get("sig");
        if (!target || !sig) return new Response("Missing url", { status: 400 });
        if (!(await verifySignature(target, sig))) {
          return new Response("Unsigned url", { status: 403 });
        }
        if (!rateLimit("recipe-image", clientKey(request), LIMIT, WINDOW_MS)) {
          return new Response("Too many requests", { status: 429 });
        }

        try {
          const upstream = await fetchImage(target);
          if (!upstream) return new Response("Bad url", { status: 400 });

          const type = upstream.headers.get("content-type") ?? "";
          const declared = Number(upstream.headers.get("content-length") ?? "0");
          if (!upstream.ok || !type.startsWith("image/") || !upstream.body) {
            return new Response("Not an image", { status: 404 });
          }
          if (declared > MAX_IMAGE_BYTES) {
            return new Response("Image too large", { status: 413 });
          }

          // Enforce the size cap even when the upstream omits content-length.
          let seen = 0;
          const capped = upstream.body.pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
              transform(chunk, controller) {
                seen += chunk.byteLength;
                if (seen > MAX_IMAGE_BYTES) {
                  controller.error(new Error("image too large"));
                  return;
                }
                controller.enqueue(chunk);
              },
            }),
          );

          return new Response(capped, {
            status: 200,
            headers: {
              "Content-Type": type,
              "Cache-Control": "public, max-age=86400",
              "X-Content-Type-Options": "nosniff",
              // An SVG served from our origin could run script; keep it inert.
              "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            },
          });
        } catch {
          return new Response("Upstream failed", { status: 502 });
        }
      },
    },
  },
});
