/**
 * Mock speech-to-text.
 *
 * Swap point for ElevenLabs Speech-to-Text: keep the same signature and
 * replace the body with a recording + transcription call.
 */
export const MOCK_TRANSCRIPT = "avocado, lemon, eggs, bread, tomatoes, cheddar";

export function transcribeMockSpeech(delayMs = 1600): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_TRANSCRIPT), delayMs));
}

export function titleCase(value: string) {
  const trimmed = value.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function parseIngredients(transcript: string): string[] {
  return transcript
    .split(/[,\n]|\band\b/gi)
    .map((part) => titleCase(part))
    .filter(Boolean);
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
