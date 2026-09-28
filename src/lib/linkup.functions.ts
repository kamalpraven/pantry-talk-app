import { createServerFn } from "@tanstack/react-start";
import {
  ASSUMED_STAPLES,
  DIET_GOALS,
  isStaple,
  normalize,
  TIME_LIMIT_MINUTES,
  type DietGoal,
  type MealPreference,
  type Recipe,
  type TimeLimit,
} from "./recipes";

/* ------------------------------ shared types ------------------------------ */

export type GroceryStore = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  estimated_distance_miles: number | null;
  directions_url: string;
  url?: string;
};

export type RecipeSearchResult = {
  recipes: Recipe[];
  error: string | null;
};

export type GrocerySearchResult = {
  stores: GroceryStore[];
  error: string | null;
};

const LINKUP_URL = "https://api.linkup.so/v1/search";

const RECIPE_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    recipes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          sourceName: { type: "string" },
          sourceUrl: { type: "string" },
          imageUrl: { type: "string" },
          timeMinutes: { type: "number" },
          servings: { type: "number" },
          blurb: { type: "string" },
          ingredients: { type: "array", items: { type: "string" } },
          steps: { type: "array", items: { type: "string" } },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          dietaryTags: { type: "array", items: { type: "string" } },
        },
        required: ["name", "sourceUrl", "timeMinutes", "ingredients", "steps"],
      },
    },
  },
  required: ["recipes"],
});

const STORE_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    stores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          address: { type: "string" },
          estimatedDistanceMiles: { type: "number" },
          url: { type: "string" },
        },
        required: ["name", "address"],
      },
    },
  },
  required: ["stores"],
});

/* ------------------------------ normalising ------------------------------- */

const UNIT_WORDS = new RegExp(
  "^(?:cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|lbs|pounds?|g|grams?|kg|ml|l|litres?|liters?|" +
    "cloves?|slices?|pinch(?:es)?|handfuls?|cans?|packets?|sprigs?|bunch(?:es)?|large|small|medium|ripe|fresh|" +
    "finely|roughly|thinly|chopped|sliced|grated|crumbled|diced|minced|of|a|an|the)\\s+",
  "i",
);

/** Removes quantities, units and prep words, keeping the full ingredient name. */
function stripIngredientLine(line: string): string {
  let value = line
    .replace(/\([^)]*\)/g, " ")
    .replace(/,.*$/, " ")
    .replace(/\b(?:to taste|optional|for serving|for garnish|plus more.*)\b/gi, " ")
    .replace(/[\d¼½¾⅓⅔⅛./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let guard = 0;
  while (UNIT_WORDS.test(value) && guard < 8) {
    value = value.replace(UNIT_WORDS, "").trim();
    guard += 1;
  }
  return value;
}

function cleanIngredient(line: string): string {
  const words = stripIngredientLine(line).split(" ").slice(0, 3).join(" ").trim();
  if (!words) return "";
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

function slugify(value: string, salt: number) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base || "recipe"}-${salt}`;
}

function toDietGoals(tags: unknown, protein: number): DietGoal[] {
  const goals = new Set<DietGoal>();
  if (Array.isArray(tags)) {
    for (const raw of tags) {
      if (typeof raw !== "string") continue;
      const value = raw.toLowerCase().replace(/[^a-z]/g, "");
      for (const goal of DIET_GOALS) {
        if (value === goal.toLowerCase().replace(/[^a-z]/g, "")) goals.add(goal);
      }
      if (value.includes("keto")) goals.add("Low Carb");
      if (value.includes("vegan")) {
        goals.add("Vegetarian");
        goals.add("Dairy Free");
      }
    }
  }
  if (protein >= 20) goals.add("High Protein");
  return [...goals];
}

function inferMealTags(recipe: {
  name: string;
  timeMinutes: number;
  protein: number;
  blurb: string;
}): MealPreference[] {
  const text = `${recipe.name} ${recipe.blurb}`.toLowerCase();
  const tags: MealPreference[] = [];
  if (recipe.timeMinutes <= 20) tags.push("Quick");
  if (recipe.protein >= 20) tags.push("High Protein");
  if (/salad|healthy|light|fresh|bowl/.test(text)) tags.push("Healthy");
  if (/breakfast|toast|omelette|omelet|pancake|scramble|morning/.test(text)) tags.push("Breakfast");
  if (/sandwich|wrap|lunch|salad/.test(text)) tags.push("Lunch");
  if (/dinner|stir.?fry|curry|roast|pasta|bowl|bake/.test(text)) tags.push("Dinner");
  return tags.length ? tags : ["Anything"];
}

type RawRecipe = Record<string, unknown>;

function normaliseRecipe(raw: RawRecipe, salt: number): Recipe | null {
  const name = typeof raw["name"] === "string" ? raw["name"].trim() : "";
  const steps = Array.isArray(raw["steps"])
    ? raw["steps"].filter((s): s is string => typeof s === "string" && s.trim().length > 8)
    : [];
  const lines = Array.isArray(raw["ingredients"])
    ? raw["ingredients"].filter((s): s is string => typeof s === "string" && s.trim().length > 1)
    : [];
  if (!name || steps.length < 2 || lines.length === 0) return null;

  const timeMinutes = Math.max(3, Math.min(240, Math.round(Number(raw["timeMinutes"]) || 25)));
  const protein = Math.max(0, Math.round(Number(raw["protein"]) || 0));
  const calories = Math.max(0, Math.round(Number(raw["calories"]) || 0));
  const carbs = Number(raw["carbs"]);
  const fat = Number(raw["fat"]);
  const blurb =
    typeof raw["blurb"] === "string" && raw["blurb"].trim()
      ? raw["blurb"].trim().slice(0, 180)
      : `A ${timeMinutes}-minute dish you can put together tonight.`;

  const cleaned: string[] = [];
  for (const line of lines) {
    // Check staples on the full name first: truncating "freshly ground black
    // pepper" to three words would otherwise hide that it's a staple.
    if (isStaple(stripIngredientLine(line))) continue;
    const item = cleanIngredient(line);
    if (!item || item.length < 3 || isStaple(item)) continue;
    if (!cleaned.some((existing) => normalize(existing) === normalize(item))) cleaned.push(item);
  }
  if (cleaned.length === 0) return null;

  const sourceUrl = typeof raw["sourceUrl"] === "string" ? raw["sourceUrl"] : "";

  return {
    id: slugify(name, salt),
    name,
    image: "",
    timeMinutes,
    servings: Math.max(1, Math.min(8, Math.round(Number(raw["servings"]) || 2))),
    blurb,
    tags: inferMealTags({ name, timeMinutes, protein, blurb }),
    dietaryTags: toDietGoals(raw["dietaryTags"], protein),
    // Only show nutrition the source actually provided. Missing values are
    // left out rather than filled with a made-up number.
    ...(calories > 0 && protein > 0
      ? {
          nutrition: {
            calories,
            protein,
            ...(Number.isFinite(carbs) && carbs > 0 ? { carbs: Math.round(carbs) } : {}),
            ...(Number.isFinite(fat) && fat > 0 ? { fat: Math.round(fat) } : {}),
          },
        }
      : {}),
    keyIngredients: cleaned.slice(0, 8),
    essentialIngredients: cleaned.slice(0, 2),
    staples: ASSUMED_STAPLES.slice(0, 3),
    steps: steps.slice(0, 12),
    ingredientLines: lines.slice(0, 20),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(typeof raw["sourceName"] === "string" && raw["sourceName"].trim()
      ? { sourceName: raw["sourceName"].trim() }
      : {}),
  };
}

/* ------------------------------ server calls ------------------------------ */

async function callLinkup(query: string, schema: string, apiKey: string) {
  const response = await fetch(LINKUP_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      q: query,
      depth: "standard",
      outputType: "structured",
      structuredOutputSchema: schema,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`linkup ${response.status}: ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

export const discoverRecipes = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      ingredients: string[];
      preference: MealPreference;
      timeLimit: TimeLimit;
      goals: DietGoal[];
    }) => {
      if (!input || !Array.isArray(input.ingredients) || input.ingredients.length === 0) {
        throw new Error("No ingredients supplied");
      }
      return {
        ingredients: input.ingredients.slice(0, 15).map((i) => String(i).slice(0, 40)),
        preference: input.preference,
        timeLimit: input.timeLimit,
        goals: Array.isArray(input.goals) ? input.goals : [],
      };
    },
  )
  .handler(async ({ data }): Promise<RecipeSearchResult> => {
    const apiKey = process.env["LINKUP_API_KEY"];
    if (!apiKey) return { recipes: [], error: "Live recipe search is not configured." };

    const minutes = TIME_LIMIT_MINUTES[data.timeLimit];
    const timeText = Number.isFinite(minutes)
      ? `Each recipe must take about ${minutes} minutes or less.`
      : "Cooking time is flexible.";
    const goalText = data.goals.length
      ? `They should suit these goals: ${data.goals.join(", ")}.`
      : "";
    const mealText =
      data.preference && data.preference !== "Anything"
        ? `Focus on ${data.preference} dishes.`
        : "";

    const query =
      `Find 10 to 14 different practical home recipes that mainly use these ingredients: ` +
      `${data.ingredients.join(", ")}. Assume salt, pepper, cooking oil, water and common dried spices ` +
      `are already available. Use sensible subsets — do not force every ingredient into every dish. ` +
      `${timeText} ${goalText} ${mealText} For each recipe include the dish name, the source website ` +
      `name and URL, total cooking time in minutes, servings, ` +
      `a one-sentence description, the ingredient list, the numbered cooking steps, and estimated ` +
      `calories, protein, carbohydrates and fat per serving.`;

    try {
      const payload = await callLinkup(query, RECIPE_SCHEMA, apiKey);
      const raw = Array.isArray(payload["recipes"]) ? (payload["recipes"] as RawRecipe[]) : [];
      const recipes: Recipe[] = [];
      raw.forEach((item, i) => {
        const recipe = normaliseRecipe(item, i + 1);
        if (recipe && !recipes.some((r) => normalize(r.name) === normalize(recipe.name))) {
          recipes.push(recipe);
        }
      });
      if (recipes.length < 3) {
        return { recipes, error: "Live recipe search returned too little to work with." };
      }

      // Resolve each photo from the actual recipe page instead of trusting an
      // image URL synthesized by search. Search results can return social icons,
      // publisher logos, or unrelated thumbnails.
      const needsImage = recipes.filter((r) => r.sourceUrl);
      if (needsImage.length) {
        const { resolveRecipeImages } = await import("./recipe-images.server");
        const found = await resolveRecipeImages(
          needsImage.map((r) => r.sourceUrl!).filter(Boolean),
        );
        for (const recipe of needsImage) {
          const image = recipe.sourceUrl ? found[recipe.sourceUrl] : undefined;
          if (image) {
            recipe.imageUrl = image;
            recipe.image = image;
          }
        }
      }

      // Route remote photos through our proxy with a server signature, so the
      // proxy only ever relays images this search actually found.
      const { signedImagePath } = await import("./server-guards");
      await Promise.all(
        recipes.map(async (recipe) => {
          const remote = recipe.imageUrl || (/^https:\/\//.test(recipe.image) ? recipe.image : "");
          if (!remote) return;
          const signed = await signedImagePath(remote);
          if (signed) {
            recipe.image = signed;
            recipe.imageUrl = signed;
          }
        }),
      );

      return { recipes, error: null };
    } catch (error) {
      console.error("linkup recipe search failed", error);
      return { recipes: [], error: "Live recipe search is unavailable." };
    }
  });

export const findGroceryStores = createServerFn({ method: "POST" })
  .inputValidator((input: { location: string; kind: "zip" | "address"; missing: string[] }) => {
    if (!input || typeof input.location !== "string" || input.location.trim().length < 3) {
      throw new Error("Enter a ZIP code or address");
    }
    return {
      location: input.location.trim().slice(0, 120),
      kind: input.kind === "address" ? ("address" as const) : ("zip" as const),
      missing: Array.isArray(input.missing) ? input.missing.slice(0, 8).map(String) : [],
    };
  })
  .handler(async ({ data }): Promise<GrocerySearchResult> => {
    const apiKey = process.env["LINKUP_API_KEY"];
    if (!apiKey) {
      return { stores: [], error: "Nearby grocery search is temporarily unavailable." };
    }

    const where =
      data.kind === "zip" ? `ZIP code ${data.location}` : `the address ${data.location}`;
    const query =
      `List 3 to 5 grocery stores or supermarkets near ${where} where someone could buy ` +
      `${data.missing.length ? data.missing.join(", ") : "everyday groceries"}. ` +
      `For each store give the store name, full street address, ` +
      `approximate distance in miles from ${where}, and the store's website URL.`;

    try {
      const payload = await callLinkup(query, STORE_SCHEMA, apiKey);
      const raw = Array.isArray(payload["stores"]) ? (payload["stores"] as RawRecipe[]) : [];
      const stores: GroceryStore[] = [];
      raw.forEach((item, i) => {
        const name = typeof item["name"] === "string" ? item["name"].trim() : "";
        const address = typeof item["address"] === "string" ? item["address"].trim() : "";
        if (!name || !address) return;
        const miles = Number(item["estimatedDistanceMiles"]);
        stores.push({
          id: slugify(name, i + 1),
          name,
          address,
          // Coordinates from a web-search model can be invented, so none are
          // stored; directions use the store name and address instead.
          latitude: null,
          longitude: null,
          estimated_distance_miles:
            Number.isFinite(miles) && miles > 0 ? Math.round(miles * 10) / 10 : null,
          directions_url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            `${name} ${address}`,
          )}`,
          ...(typeof item["url"] === "string" && /^https?:\/\//.test(item["url"])
            ? { url: item["url"] }
            : {}),
        });
      });
      if (stores.length === 0) {
        return { stores: [], error: "Nearby grocery search is temporarily unavailable." };
      }
      return { stores, error: null };
    } catch (error) {
      console.error("linkup grocery search failed", error);
      return { stores: [], error: "Nearby grocery search is temporarily unavailable." };
    }
  });
