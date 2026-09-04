/**
 * Speech input.
 *
 * Recording happens in the browser (Web Audio → WAV) and transcription happens
 * server-side at /api/transcribe, so no key is ever exposed to the client.
 */

export const MOCK_TRANSCRIPT = "avocado, lemon, eggs, bread, tomatoes, cheddar";

export type Recorder = {
  stop: () => Promise<Blob>;
  cancel: () => void;
};

function encodeWav(chunks: Float32Array[], sampleRate: number, targetRate = 16000): Blob {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const ratio = sampleRate / targetRate;
  const outLength = Math.floor(merged.length / ratio);
  const samples = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    samples[i] = merged[Math.floor(i * ratio)] ?? 0;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (pos: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(pos + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let pos = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(pos, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    pos += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];

  node.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(node);
  node.connect(ctx.destination);

  const teardown = () => {
    stream.getTracks().forEach((t) => t.stop());
    node.disconnect();
    source.disconnect();
  };

  return {
    stop: async () => {
      teardown();
      const blob = encodeWav(chunks, ctx.sampleRate);
      await ctx.close();
      return blob;
    },
    cancel: () => {
      teardown();
      void ctx.close();
    },
  };
}

export class SpeechError extends Error {}

export async function transcribeAudio(blob: Blob): Promise<string> {
  if (blob.size < 2048) {
    throw new SpeechError("That recording was empty — please try again.");
  }
  const body = new FormData();
  body.append("audio", blob, "recording.wav");

  const response = await fetch("/api/transcribe", { method: "POST", body });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new SpeechError(detail || "Could not transcribe that recording.");
  }
  const data = (await response.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  if (!text) throw new SpeechError("I didn't catch anything — please try again.");
  return text;
}

export function titleCase(value: string) {
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

const FILLER = /^(?:i\s+have|i've\s+got|i\s+got|there'?s|we\s+have|some|a|an|the)\s+/i;

export function parseIngredients(transcript: string): string[] {
  return transcript
    .replace(/[.!?]/g, "")
    .split(/[,\n]|\band\b/gi)
    .map((part) => titleCase(part.replace(FILLER, "")))
    .filter((part) => part.length > 1);
}

/**
 * Swap point for ElevenLabs Text-to-Speech narration of a cooking step.
 */
export function speakStep(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}
