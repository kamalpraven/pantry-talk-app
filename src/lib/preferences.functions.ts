import { createServerFn } from "@tanstack/react-start";
import {
  DIET_GOALS,
  TIME_LIMITS,
  type DietGoal,
  type MealPreference,
  type TimeLimit,
} from "./recipes";

export type ParsedPreferences = {
  timeLimit: TimeLimit;
  goals: DietGoal[];
  preference: MealPreference;
};

const MEALS: MealPreference[] = [
  "Anything",
  "Quick",
  "High Protein",
  "Healthy",
  "Breakfast",
  "Lunch",
  "Dinner",
];

/** Keyword fallback used when the AI call fails or returns nothing usable. */
export function parsePreferencesLocally(text: string): ParsedPreferences {
  const value = text.toLowerCase();
  const goals: DietGoal[] = [];
  if (/high.?protein|protein|filling/.test(value)) goals.push("High Protein");
  if (/vegetarian|veggie|meat.?free/.test(value)) goals.push("Vegetarian");
  if (/low.?carb|keto/.test(value)) goals.push("Low Carb");
  if (/dairy.?free|no dairy|lactose/.test(value)) goals.push("Dairy Free");
  if (/gluten.?free|no gluten/.test(value)) goals.push("Gluten Free");

  const words: Record<string, number> = {
    ten: 10,
    twelve: 12,
    fifteen: 15,
    twenty: 20,
    "twenty five": 25,
    thirty: 30,
    forty: 40,
    sixty: 60,
  };
  let minutes: number | null = null;
  const digits = /(\d+)\s*(?:minute|minutes|min|mins)/.exec(value);
  if (digits?.[1]) minutes = Number(digits[1]);
  else {
    for (const [word, n] of Object.entries(words)) {
      if (new RegExp(`${word}\\s*(?:minute|minutes|min|mins)`).test(value)) {
        minutes = n;
        break;
      }
    }
  }
  if (minutes === null && /quick|fast|hurry|rush/.test(value)) minutes = 15;

  let timeLimit: TimeLimit = "No rush";
  if (minutes !== null)
    timeLimit = minutes <= 15 ? "Under 15 min" : minutes <= 30 ? "Under 30 min" : "No rush";

  let preference: MealPreference = "Anything";
  if (/breakfast|morning/.test(value)) preference = "Breakfast";
  else if (/lunch/.test(value)) preference = "Lunch";
  else if (/dinner|tonight|evening/.test(value)) preference = "Dinner";
  else if (/healthy|light|fresh/.test(value)) preference = "Healthy";
  else if (goals.includes("High Protein")) preference = "High Protein";
  else if (minutes !== null && minutes <= 15) preference = "Quick";

  return { timeLimit, goals, preference };
}

export const interpretPreferences = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string }) => {
    if (!input || typeof input.text !== "string" || !input.text.trim()) {
      throw new Error("Nothing to interpret");
    }
    return { text: input.text.slice(0, 500) };
  })
  .handler(async ({ data }): Promise<ParsedPreferences> => {
    const fallback = parsePreferencesLocally(data.text);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return fallback;

    try {
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
                "You turn a cook's spoken wish into structured recipe filters. Reply with JSON only. " +
                `timeLimit must be one of ${JSON.stringify(TIME_LIMITS)} (round a spoken limit up to the closest option). ` +
                `goals is an array from ${JSON.stringify(DIET_GOALS)}. ` +
                `preference must be one of ${JSON.stringify(MEALS)}.`,
            },
            { role: "user", content: data.text },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "preferences",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  timeLimit: { type: "string", enum: TIME_LIMITS },
                  goals: { type: "array", items: { type: "string", enum: DIET_GOALS } },
                  preference: { type: "string", enum: MEALS },
                },
                required: ["timeLimit", "goals", "preference"],
              },
            },
          },
        }),
      });

      if (!response.ok) {
        console.error(
          "preference parsing failed",
          response.status,
          await response.text().catch(() => ""),
        );
        return fallback;
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return fallback;
      const parsed = JSON.parse(content) as Partial<ParsedPreferences>;

      return {
        timeLimit: TIME_LIMITS.includes(parsed.timeLimit as TimeLimit)
          ? (parsed.timeLimit as TimeLimit)
          : fallback.timeLimit,
        goals: Array.isArray(parsed.goals)
          ? parsed.goals.filter((g): g is DietGoal => DIET_GOALS.includes(g as DietGoal))
          : fallback.goals,
        preference: MEALS.includes(parsed.preference as MealPreference)
          ? (parsed.preference as MealPreference)
          : fallback.preference,
      };
    } catch (error) {
      console.error("preference parsing error", error);
      return fallback;
    }
  });
