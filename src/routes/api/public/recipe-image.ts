import { createFileRoute } from "@tanstack/react-router";

/**
 * Image passthrough so recipe photos that block hotlinking still display.
 * Only https image responses are relayed, and nothing else is proxied.
 */
export const Route = createFileRoute("/api/public/recipe-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("url");
        if (!target) return new Response("Missing url", { status: 400 });

        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return new Response("Bad url", { status: 400 });
        }
        if (parsed.protocol !== "https:") return new Response("Bad url", { status: 400 });

        try {
          const upstream = await fetch(parsed.toString(), {
            headers: {
              Accept: "image/*",
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
              Referer: `${parsed.protocol}//${parsed.host}/`,
            },
            redirect: "follow",
          });
          const type = upstream.headers.get("content-type") ?? "";
          if (!upstream.ok || !type.startsWith("image/")) {
            return new Response("Not an image", { status: 404 });
          }
          return new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type": type,
              "Cache-Control": "public, max-age=86400",
            },
          });
        } catch {
          return new Response("Upstream failed", { status: 502 });
        }
      },
    },
  },
});
