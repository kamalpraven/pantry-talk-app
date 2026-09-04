import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * ElevenLabs Speech-to-Text (Scribe). Used for ingredient input, mood input and
 * spoken cooking commands. The API key never leaves the server.
 */
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["ELEVENLABS_API_KEY"];
        if (!apiKey) {
          return new Response("Transcription is not configured.", { status: 500 });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response("Expected an audio upload.", { status: 400 });
        }

        const audio = form.get("audio");
        if (!(audio instanceof File) || audio.size === 0) {
          return new Response("No audio received.", { status: 400 });
        }
        if (audio.size > MAX_BYTES) {
          return new Response("That recording is too long.", { status: 400 });
        }

        const extensions: Record<string, string> = {
          "audio/wav": "wav",
          "audio/x-wav": "wav",
          "audio/webm": "webm",
          "audio/mp4": "mp4",
          "audio/mpeg": "mp3",
        };
        const ext = extensions[(audio.type || "audio/wav").split(";")[0] ?? ""] ?? "wav";

        const upstream = new FormData();
        upstream.append("model_id", "scribe_v1");
        upstream.append("language_code", "eng");
        upstream.append("file", audio, `recording.${ext}`);

        const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: upstream,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error("transcription failed", response.status, detail);
          const message =
            response.status === 429
              ? "Too many requests right now — try again in a moment."
              : "I didn't catch that. Try again.";
          return new Response(message, { status: response.status });
        }

        const data = (await response.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
