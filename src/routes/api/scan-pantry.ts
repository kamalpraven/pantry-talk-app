import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ScanItem = {
  name: string;
  quantityEstimate: number;
  unit: "count" | "g" | "ml" | "portion";
  confidence: number;
  useSoonDays?: number;
};

function clampItem(raw: Record<string, unknown>): ScanItem | null {
  const name = typeof raw["name"] === "string" ? raw["name"].trim().slice(0, 48) : "";
  if (!name) return null;

  const allowedUnits = new Set(["count", "g", "ml", "portion"]);
  const unit = allowedUnits.has(String(raw["unit"]))
    ? (String(raw["unit"]) as ScanItem["unit"])
    : "portion";
  const quantity = Number(raw["quantityEstimate"]);
  const confidence = Number(raw["confidence"]);
  const useSoonRaw = raw["useSoonDays"];
  const useSoonDays = useSoonRaw == null ? Number.NaN : Number(useSoonRaw);

  return {
    name,
    quantityEstimate: Number.isFinite(quantity) ? Math.max(0.1, Math.min(quantity, 5000)) : 1,
    unit,
    confidence: Number.isFinite(confidence) ? Math.max(0.2, Math.min(confidence, 0.99)) : 0.6,
    ...(Number.isFinite(useSoonDays) ? { useSoonDays: Math.max(0, Math.min(30, Math.round(useSoonDays))) } : {}),
  };
}

export const Route = createFileRoute("/api/scan-pantry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("Kitchen vision is not configured.", { status: 503 });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response("Expected an image upload.", { status: 400 });
        }

        const image = form.get("image");
        if (!(image instanceof File) || image.size === 0) {
          return new Response("No kitchen image received.", { status: 400 });
        }
        if (image.size > MAX_BYTES) {
          return new Response("That image is too large. Use an image under 6 MB.", { status: 400 });
        }
        if (!ALLOWED_TYPES.has(image.type)) {
          return new Response("Use a JPG, PNG or WebP image.", { status: 400 });
        }

        const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
        const dataUrl = `data:${image.type};base64,${base64}`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            messages: [
              {
                role: "system",
                content:
                  "You inspect a household kitchen or grocery photo for a cooking assistant. " +
                  "Identify only clearly visible edible grocery items. Do not invent hidden foods or infer brands. " +
                  "Prefer useful canonical names such as Eggs, Tomatoes, Chicken, Mushrooms, Yogurt. " +
                  "Estimate counts only when visibly countable. Otherwise use unit=portion and quantityEstimate=1. " +
                  "Use g or ml only when a package label makes the quantity reasonably visible. " +
                  "confidence is 0 to 1 and should reflect visual certainty. " +
                  "useSoonDays is an approximate planning signal, not a food-safety or expiry claim; omit it when uncertain. " +
                  "Return no more than 15 items.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "What useful foods can you clearly see in this kitchen photo? Return structured pantry state.",
                  },
                  {
                    type: "image_url",
                    image_url: { url: dataUrl },
                  },
                ],
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "pantry_scan",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    items: {
                      type: "array",
                      maxItems: 15,
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          name: { type: "string" },
                          quantityEstimate: { type: "number" },
                          unit: { type: "string", enum: ["count", "g", "ml", "portion"] },
                          confidence: { type: "number" },
                          useSoonDays: { type: ["number", "null"] },
                        },
                        required: ["name", "quantityEstimate", "unit", "confidence", "useSoonDays"],
                      },
                    },
                  },
                  required: ["items"],
                },
              },
            },
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error("pantry scan failed", response.status, detail.slice(0, 400));
          return new Response("I couldn't read that kitchen photo. Try another image.", {
            status: response.status || 502,
          });
        }

        const payload = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = payload.choices?.[0]?.message?.content;
        if (!content) return new Response("No foods were detected.", { status: 422 });

        try {
          const parsed = JSON.parse(content) as { items?: Record<string, unknown>[] };
          const items = (parsed.items ?? []).map(clampItem).filter((item): item is ScanItem => item !== null);
          if (!items.length) return new Response("No clear foods were detected. Try a closer photo.", { status: 422 });
          return Response.json({ items });
        } catch (error) {
          console.error("pantry scan parse error", error);
          return new Response("I couldn't interpret that photo. Try another one.", { status: 502 });
        }
      },
    },
  },
});
