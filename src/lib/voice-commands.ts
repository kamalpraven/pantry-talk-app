import { formatSpokenTime, type Recipe } from "./recipes";

export type VoiceCommand =
  | { kind: "next" }
  | { kind: "previous" }
  | { kind: "repeat" }
  | { kind: "startTimer"; seconds: number | null }
  | { kind: "pauseTimer" }
  | { kind: "resumeTimer" }
  | { kind: "stopTimer" }
  | { kind: "timeLeft" }
  | { kind: "currentStep" }
  | { kind: "nextStep" }
  | { kind: "ingredient"; query: string }
  | { kind: "temperature" }
  | { kind: "unknown" };

const NUMBER_WORDS: Record<string, number> = {
  half: 0.5,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  sixty: 60,
};

/** "start a timer for three minutes" → 180 */
export function parseSpokenDuration(text: string): number | null {
  const value = text.toLowerCase();
  const digits = /(\d+(?:\.\d+)?)\s*(minute|minutes|min|mins|second|seconds|sec|secs)\b/.exec(value);
  if (digits?.[1]) {
    const amount = Number(digits[1]);
    return (digits[2] ?? "").startsWith("sec") ? Math.round(amount) : Math.round(amount * 60);
  }
  const words = Object.keys(NUMBER_WORDS).join("|");
  const spoken = new RegExp(
    `\\b(${words})\\s*(?:and a half\\s*)?(minute|minutes|second|seconds)\\b`,
  ).exec(value);
  if (spoken?.[1]) {
    const amount = NUMBER_WORDS[spoken[1]] ?? 0;
    if (!amount) return null;
    return (spoken[2] ?? "").startsWith("second") ? Math.round(amount) : Math.round(amount * 60);
  }
  return null;
}

export function parseCommand(raw: string): VoiceCommand {
  const text = raw.toLowerCase().replace(/[.!?,]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return { kind: "unknown" };

  // Questions and timer phrases first — they often contain words like "next".
  if (/(how much|how many|what).*(time|long).*(left|remaining)|time remaining|time left/.test(text))
    return { kind: "timeLeft" };
  if (/(stop|cancel|kill|clear).*(timer)/.test(text)) return { kind: "stopTimer" };
  if (/(pause|hold).*(timer)/.test(text)) return { kind: "pauseTimer" };
  if (/(resume|continue|restart|unpause).*(timer)/.test(text)) return { kind: "resumeTimer" };
  if (/(start|set|begin|kick off).*(timer)|timer for/.test(text))
    return { kind: "startTimer", seconds: parseSpokenDuration(text) };

  if (/(what|which).*(step).*(on|at|are we|am i)|where am i/.test(text))
    return { kind: "currentStep" };
  if (/(what|what's).*(comes? next|next step|after this)/.test(text)) return { kind: "nextStep" };
  if (/(what|which).*(temperature|heat|degrees)/.test(text)) return { kind: "temperature" };

  const quantity = /how (?:much|many)\s+(.+?)(?:\s+do i need| do i| need|\?|$)/.exec(text);
  if (quantity?.[1]) return { kind: "ingredient", query: quantity[1].trim() };

  if (/(previous|go back|back a step|last step|before)/.test(text)) return { kind: "previous" };
  if (/(repeat|again|say that|what did you say|one more time)/.test(text)) return { kind: "repeat" };
  if (/(next|continue|carry on|move on|go on|done|finished|got it|ready)/.test(text))
    return { kind: "next" };

  return { kind: "unknown" };
}

type Context = {
  recipe: Recipe;
  index: number;
  remainingSeconds: number | null;
  timerActive: boolean;
};

/** Answers spoken questions using only the selected recipe's own data. */
export function answerFor(command: VoiceCommand, ctx: Context): string {
  const { recipe, index } = ctx;
  const total = recipe.steps.length;

  switch (command.kind) {
    case "timeLeft":
      if (!ctx.timerActive || ctx.remainingSeconds === null) return "No timer is running right now.";
      if (ctx.remainingSeconds <= 0) return "The timer has finished.";
      return `You have ${formatSpokenTime(ctx.remainingSeconds)} remaining.`;
    case "currentStep":
      return `You're on step ${index + 1} of ${total}. ${recipe.steps[index] ?? ""}`;
    case "nextStep": {
      const next = recipe.steps[index + 1];
      return next ? `Next up: ${next}` : "That was the last step — you're done.";
    }
    case "temperature": {
      const step = recipe.steps.find((s) => /degrees|°|medium|high heat|low heat|grill|oven/i.test(s));
      return step ? step : "This recipe doesn't give a temperature.";
    }
    case "ingredient": {
      const query = command.query.replace(/^(?:of|the)\s+/, "").trim();
      const found = recipe.ingredientLines?.find((line) =>
        line.toLowerCase().includes(query.split(" ")[0] ?? query),
      );
      if (found) return found;
      const step = recipe.steps.find((s) => s.toLowerCase().includes(query.split(" ")[0] ?? query));
      if (step) return step;
      const listed = recipe.keyIngredients.find((item) =>
        item.toLowerCase().includes(query.split(" ")[0] ?? query),
      );
      return listed
        ? `${listed} is in the recipe, but no exact amount is given.`
        : `I don't see ${query} in this recipe.`;
    }
    default:
      return "";
  }
}
