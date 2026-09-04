import { createFileRoute } from "@tanstack/react-router";

/**
 * ElevenLabs Text-to-Speech. The API key stays server-side; the browser only
 * ever receives audio bytes.
 */
const VOICE_ID = "XrExE9yKIg1WjnnlVkGX"; // Matilda — warm, clear narration
const MODEL_ID = "eleven_flash_v2_5";

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["ELEVENLABS_API_KEY"];
        if (!apiKey) {
          return new Response("Voice is not configured.", { status: 500 });
        }

        let text = "";
        try {
          const body = (await request.json()) as { text?: unknown };
          if (typeof body.text === "string") text = body.text.trim().slice(0, 900);
        } catch {
          return new Response("Expected JSON with a text field.", { status: 400 });
        }
        if (!text) return new Response("Nothing to say.", { status: 400 });

        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`,
          {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text,
              model_id: MODEL_ID,
              voice_settings: { stability: 0.4, similarity_boost: 0.75, speed: 0.95 },
            }),
          },
        );

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          console.error("tts failed", upstream.status, detail);
          return new Response("Could not read that out loud.", { status: upstream.status || 502 });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
