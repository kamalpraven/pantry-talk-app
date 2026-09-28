import { createServerFn } from "@tanstack/react-start";

import {
  findCatalogCandidates,
  findCatalogRecipe,
  type CatalogCandidate,
} from "./recipe-catalog";

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
          catalogId: { type: "string" },
          name: { type: "string" },
          sourceName: { type: "string" },
          sourceUrl: { type: "string" },
          imageUrl: { type: "string" },
          timeMinutes: { type: "number" },
          servings: { type: "number" },
          blurb: { type: "string" },
          ingredients: {
            type: "array",
            items: { type: "string" },
          },
          steps: {
            type: "array",
            items: { type: "string" },
          },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          dietaryTags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "name",
          "sourceUrl",
          "timeMinutes",
          "ingredients",
          "steps",
        ],
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
          latitude: { type: "number" },
          longitude: { type: "number" },
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

function cleanIngredient(line: string): string {
  let value = line
    .replace(/\([^)]*\)/g, " ")
    .replace(/,.*$/, " ")
    .replace(
      /\b(?:to taste|optional|for serving|for garnish|plus more.*)\b/gi,
      " ",
    )
    .replace(/[\d¼½¾⅓⅔⅛.\/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let guard = 0;

  while (UNIT_WORDS.test(value) && guard < 8) {
    value = value.replace(UNIT_WORDS, "").trim();
    guard += 1;
  }

  const words = value.split(" ").slice(0, 3).join(" ").trim();

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
        if (value === goal.toLowerCase().replace(/[^a-z]/g, "")) {
          goals.add(goal);
        }
      }

      if (value.includes("keto")) {
        goals.add("Low Carb");
      }

      if (value.includes("vegan")) {
        goals.add("Vegetarian");
        goals.add("Dairy Free");
      }
    }
  }

  if (protein >= 20) {
    goals.add("High Protein");
  }

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

  if (recipe.timeMinutes <= 20) {
    tags.push("Quick");
  }

  if (recipe.protein >= 20) {
    tags.push("High Protein");
  }

  if (/salad|healthy|light|fresh|bowl/.test(text)) {
    tags.push("Healthy");
  }

  if (
    /breakfast|toast|omelette|omelet|pancake|scramble|morning/.test(text)
  ) {
    tags.push("Breakfast");
  }

  if (/sandwich|wrap|lunch|salad/.test(text)) {
    tags.push("Lunch");
  }

  if (/dinner|stir.?fry|curry|roast|pasta|bowl|bake/.test(text)) {
    tags.push("Dinner");
  }

  return tags.length ? tags : ["Anything"];
}

type RawRecipe = Record<string, unknown>;

function normaliseRecipe(
  raw: RawRecipe,
  salt: number,
  catalogById?: Map<string, CatalogCandidate>,
): Recipe | null {
  const name =
    typeof raw["name"] === "string" ? raw["name"].trim() : "";

  const steps = Array.isArray(raw["steps"])
    ? raw["steps"].filter(
        (s): s is string =>
          typeof s === "string" && s.trim().length > 8,
      )
    : [];

  const lines = Array.isArray(raw["ingredients"])
    ? raw["ingredients"].filter(
        (s): s is string =>
          typeof s === "string" && s.trim().length > 1,
      )
    : [];

  if (!name || steps.length < 2 || lines.length === 0) {
    return null;
  }

  const timeMinutes = Math.max(
    3,
    Math.min(
      240,
      Math.round(Number(raw["timeMinutes"]) || 25),
    ),
  );

  const protein = Math.max(
    0,
    Math.round(Number(raw["protein"]) || 0),
  );

  const calories = Math.max(
    0,
    Math.round(Number(raw["calories"]) || 0),
  );

  const carbs = Number(raw["carbs"]);
  const fat = Number(raw["fat"]);

  const blurb =
    typeof raw["blurb"] === "string" && raw["blurb"].trim()
      ? raw["blurb"].trim().slice(0, 180)
      : `A ${timeMinutes}-minute dish you can put together tonight.`;

  const cleaned: string[] = [];

  for (const line of lines) {
    const item = cleanIngredient(line);

    if (!item || item.length < 3 || isStaple(item)) {
      continue;
    }

    if (
      !cleaned.some(
        (existing) =>
          normalize(existing) === normalize(item),
      )
    ) {
      cleaned.push(item);
    }
  }

  if (cleaned.length === 0) {
    return null;
  }

  const discoveredSourceUrl =
    typeof raw["sourceUrl"] === "string"
      ? raw["sourceUrl"]
      : "";

  const rawCatalogId =
    typeof raw["catalogId"] === "string"
      ? raw["catalogId"].trim()
      : "";

  const lockedCandidate =
    rawCatalogId && catalogById
      ? catalogById.get(rawCatalogId)
      : undefined;

  const catalog =
    lockedCandidate?.entry ?? findCatalogRecipe(name);

  const resolvedName =
    lockedCandidate?.entry.name ?? name;

  const sourceUrl =
    catalog?.url ??
    (/^https:\/\//.test(discoveredSourceUrl)
      ? discoveredSourceUrl
      : "");

  const catalogImage = catalog?.image ?? "";

  return {
    id: slugify(resolvedName, salt),
    name: resolvedName,
    image: catalogImage,

    ...(catalogImage
      ? {
          imageUrl: catalogImage,
        }
      : {}),

    timeMinutes,

    servings: Math.max(
      1,
      Math.min(
        8,
        Math.round(Number(raw["servings"]) || 2),
      ),
    ),

    blurb,

    tags: inferMealTags({
      name: resolvedName,
      timeMinutes,
      protein,
      blurb,
    }),

    dietaryTags: toDietGoals(
      raw["dietaryTags"],
      protein,
    ),

    nutrition: {
      calories:
        calories ||
        Math.round(timeMinutes * 14 + 220),

      protein: protein || 12,

      ...(Number.isFinite(carbs) && carbs > 0
        ? {
            carbs: Math.round(carbs),
          }
        : {}),

      ...(Number.isFinite(fat) && fat > 0
        ? {
            fat: Math.round(fat),
          }
        : {}),
    },

    keyIngredients: cleaned.slice(0, 8),

    essentialIngredients: cleaned.slice(0, 2),

    staples: ASSUMED_STAPLES.slice(0, 3),

    steps: steps.slice(0, 12),

    ingredientLines: lines.slice(0, 20),

    ...(sourceUrl
      ? {
          sourceUrl,
        }
      : {}),

    ...(typeof raw["sourceName"] === "string" &&
    raw["sourceName"].trim()
      ? {
          sourceName: raw["sourceName"].trim(),
        }
      : {}),
  };
}

/* ------------------------------ server calls ------------------------------ */

async function callLinkup(
  query: string,
  schema: string,
  apiKey: string,
) {
  const response = await fetch(LINKUP_URL, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      q: query,
      depth: "standard",
      outputType: "structured",
      structuredOutputSchema: schema,
    }),
  });

  if (!response.ok) {
    const detail = await response
      .text()
      .catch(() => "");

    throw new Error(
      `linkup ${response.status}: ${detail.slice(0, 200)}`,
    );
  }

  return (await response.json()) as Record<
    string,
    unknown
  >;
}

/* --------------------------- recipe discovery ----------------------------- */

export const discoverRecipes = createServerFn({
  method: "POST",
})
  .inputValidator(
    (input: {
      ingredients: string[];
      preference: MealPreference;
      timeLimit: TimeLimit;
      goals: DietGoal[];
    }) => {
      if (
        !input ||
        !Array.isArray(input.ingredients) ||
        input.ingredients.length === 0
      ) {
        throw new Error("No ingredients supplied");
      }

      return {
        ingredients: input.ingredients
          .slice(0, 15)
          .map((i) =>
            String(i).slice(0, 40),
          ),

        preference: input.preference,

        timeLimit: input.timeLimit,

        goals: Array.isArray(input.goals)
          ? input.goals
          : [],
      };
    },
  )
  .handler(
    async ({
      data,
    }): Promise<RecipeSearchResult> => {
      const apiKey =
        process.env["LINKUP_API_KEY"];

      if (!apiKey) {
        return {
          recipes: [],
          error:
            "Live recipe search is not configured.",
        };
      }

      const minutes =
        TIME_LIMIT_MINUTES[data.timeLimit];

      const timeText = Number.isFinite(minutes)
        ? `Prefer recipes that can be completed in about ${minutes} minutes or less.`
        : "Cooking time is flexible.";

      const goalText = data.goals.length
        ? `Prefer recipes that suit: ${data.goals.join(", ")}.`
        : "";

      const mealText =
        data.preference &&
        data.preference !== "Anything"
          ? `Prefer ${data.preference} dishes where sensible.`
          : "";

      /*
       * Local-first:
       *
       * Choose real catalog records before Linkup
       * is allowed to enrich them.
       *
       * This guarantees the primary recommendation
       * path begins with known images and source URLs.
       */
      const localCandidates =
        findCatalogCandidates(
          data.ingredients,
          10,
        );

      if (localCandidates.length >= 3) {
        const catalogById = new Map(
          localCandidates.map(
            (candidate) => [
              candidate.entry.id,
              candidate,
            ],
          ),
        );

        const candidateList =
          localCandidates
            .map(
              ({
                entry,
                matched,
                matchPercent,
              }) =>
                `${entry.id} | ${entry.name} | ${entry.url} | pantry matches: ${matched.join(", ")} | ${matchPercent}%`,
            )
            .join("\n");

        const query =
          `Enrich 6 to 8 recipes from this exact Pantry Talk catalog list. ` +
          `Do not invent a different recipe and do not rename the dishes. Preserve catalogId exactly.\n\n` +
          `${candidateList}\n\n` +
          `The household currently has: ${data.ingredients.join(", ")}. ` +
          `${timeText} ${goalText} ${mealText} ` +
          `For each selected catalog recipe return catalogId, the exact dish name, the source URL shown above, ` +
          `total cooking time, servings, a short description, full ingredient list, numbered cooking steps, ` +
          `and estimated calories, protein, carbohydrates and fat per serving. ` +
          `Only return dishes from the catalog list above.`;

        try {
          const payload = await callLinkup(
            query,
            RECIPE_SCHEMA,
            apiKey,
          );

          const raw = Array.isArray(
            payload["recipes"],
          )
            ? (payload[
                "recipes"
              ] as RawRecipe[])
            : [];

          const recipes: Recipe[] = [];

          raw.forEach((item, i) => {
            const catalogId =
              typeof item["catalogId"] ===
              "string"
                ? item[
                    "catalogId"
                  ].trim()
                : "";

            if (
              !catalogId ||
              !catalogById.has(catalogId)
            ) {
              return;
            }

            const recipe =
              normaliseRecipe(
                item,
                i + 1,
                catalogById,
              );

            if (
              recipe &&
              !recipes.some(
                (r) =>
                  normalize(r.name) ===
                  normalize(recipe.name),
              )
            ) {
              recipes.push(recipe);
            }
          });

          if (recipes.length >= 3) {
            return {
              recipes,
              error: null,
            };
          }
        } catch (error) {
          console.error(
            "catalog recipe enrichment failed",
            error,
          );
        }
      }

      /*
       * Fallback for unusual pantry combinations.
       *
       * Linkup can discover recipes, and we attempt
       * to attach a catalog image where possible.
       * If no catalog image exists, the recipe's
       * own source page is used as an image fallback.
       */
      const fallbackQuery =
        `Find 10 to 14 different practical home recipes that mainly use these ingredients: ` +
        `${data.ingredients.join(", ")}. ` +
        `Assume salt, pepper, cooking oil, water and common dried spices are already available. ` +
        `Use sensible subsets — do not force every ingredient into every dish. ` +
        `${timeText} ${goalText} ${mealText} ` +
        `For each recipe include the dish name, the source website name and URL, ` +
        `total cooking time in minutes, servings, a one-sentence description, ` +
        `the ingredient list, numbered cooking steps, and estimated calories, protein, carbohydrates and fat.`;

      try {
        const payload = await callLinkup(
          fallbackQuery,
          RECIPE_SCHEMA,
          apiKey,
        );

        const raw = Array.isArray(
          payload["recipes"],
        )
          ? (payload[
              "recipes"
            ] as RawRecipe[])
          : [];

        const recipes: Recipe[] = [];

        /*
         * Do NOT reject image-less recipes here.
         *
         * They need to survive this stage so the
         * image resolver below has a chance to
         * fetch the image from the source page.
         */
        raw.forEach((item, i) => {
          const recipe =
            normaliseRecipe(
              item,
              i + 1,
            );

          if (
            recipe &&
            !recipes.some(
              (r) =>
                normalize(r.name) ===
                normalize(recipe.name),
            )
          ) {
            recipes.push(recipe);
          }
        });

        /*
         * Catalog images win.
         *
         * For anything still missing an image,
         * look up the image from the recipe's
         * own source page.
         */
        const needs = recipes
          .filter(
            (recipe) =>
              !recipe.image &&
              recipe.sourceUrl,
          )
          .map(
            (recipe) =>
              recipe.sourceUrl!,
          );

        if (needs.length) {
          const {
            resolveRecipeImages,
          } = await import(
            "./recipe-images.server"
          );

          const found =
            await Promise.race([
              resolveRecipeImages(
                needs,
                6,
              ),

              new Promise<
                Record<string, string>
              >((resolve) =>
                setTimeout(
                  () => resolve({}),
                  8000,
                ),
              ),
            ]);

          for (const recipe of recipes) {
            const image =
              recipe.sourceUrl
                ? found[
                    recipe.sourceUrl
                  ]
                : undefined;

            if (
              !recipe.image &&
              image
            ) {
              recipe.image = image;
              recipe.imageUrl =
                image;
            }
          }
        }

        /*
         * Only return recipes that have a
         * usable image after catalog +
         * source-page resolution.
         */
        const imageBackedRecipes =
          recipes.filter(
            (recipe) =>
              Boolean(recipe.image),
          );

        if (
          imageBackedRecipes.length <
          3
        ) {
          return {
            recipes: [],
            error:
              "Not enough image-backed catalog recipes matched this pantry yet.",
          };
        }

        return {
          recipes:
            imageBackedRecipes,
          error: null,
        };
      } catch (error) {
        console.error(
          "linkup recipe search failed",
          error,
        );

        return {
          recipes: [],
          error:
            "Live recipe search is unavailable.",
        };
      }
    },
  );

/* ---------------------------- grocery search ------------------------------ */

export const findGroceryStores =
  createServerFn({
    method: "POST",
  })
    .inputValidator(
      (input: {
        location: string;
        kind:
          | "zip"
          | "address";
        missing: string[];
      }) => {
        if (
          !input ||
          typeof input.location !==
            "string" ||
          input.location.trim()
            .length < 3
        ) {
          throw new Error(
            "Enter a ZIP code or address",
          );
        }

        return {
          location: input.location
            .trim()
            .slice(0, 120),

          kind:
            input.kind ===
            "address"
              ? ("address" as const)
              : ("zip" as const),

          missing: Array.isArray(
            input.missing,
          )
            ? input.missing
                .slice(0, 8)
                .map(String)
            : [],
        };
      },
    )
    .handler(
      async ({
        data,
      }): Promise<GrocerySearchResult> => {
        const apiKey =
          process.env[
            "LINKUP_API_KEY"
          ];

        if (!apiKey) {
          return {
            stores: [],
            error:
              "Nearby grocery search is temporarily unavailable.",
          };
        }

        const where =
          data.kind === "zip"
            ? `ZIP code ${data.location}`
            : `the address ${data.location}`;

        const query =
          `List 3 to 5 grocery stores or supermarkets near ${where} where someone could buy ` +
          `${
            data.missing.length
              ? data.missing.join(
                  ", ",
                )
              : "everyday groceries"
          }. ` +
          `For each store give the store name, full street address, latitude, longitude, ` +
          `approximate distance in miles from ${where}, and the store's website URL.`;

        try {
          const payload =
            await callLinkup(
              query,
              STORE_SCHEMA,
              apiKey,
            );

          const raw =
            Array.isArray(
              payload["stores"],
            )
              ? (payload[
                  "stores"
                ] as RawRecipe[])
              : [];

          const stores: GroceryStore[] =
            [];

          raw.forEach(
            (item, i) => {
              const name =
                typeof item[
                  "name"
                ] === "string"
                  ? item[
                      "name"
                    ].trim()
                  : "";

              const address =
                typeof item[
                  "address"
                ] === "string"
                  ? item[
                      "address"
                    ].trim()
                  : "";

              if (
                !name ||
                !address
              ) {
                return;
              }

              const lat = Number(
                item["latitude"],
              );

              const lng = Number(
                item["longitude"],
              );

              const miles = Number(
                item[
                  "estimatedDistanceMiles"
                ],
              );

              stores.push({
                id: slugify(
                  name,
                  i + 1,
                ),

                name,

                address,

                latitude:
                  Number.isFinite(
                    lat,
                  ) && lat !== 0
                    ? lat
                    : null,

                longitude:
                  Number.isFinite(
                    lng,
                  ) && lng !== 0
                    ? lng
                    : null,

                estimated_distance_miles:
                  Number.isFinite(
                    miles,
                  ) &&
                  miles > 0
                    ? Math.round(
                        miles *
                          10,
                      ) / 10
                    : null,

                directions_url:
                  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                    `${name} ${address}`,
                  )}`,

                ...(typeof item[
                  "url"
                ] ===
                  "string" &&
                /^https?:\/\//.test(
                  item["url"],
                )
                  ? {
                      url: item[
                        "url"
                      ] as string,
                    }
                  : {}),
              });
            },
          );

          if (
            stores.length === 0
          ) {
            return {
              stores: [],
              error:
                "Nearby grocery search is temporarily unavailable.",
            };
          }

          return {
            stores,
            error: null,
          };
        } catch (error) {
          console.error(
            "linkup grocery search failed",
            error,
          );

          return {
            stores: [],
            error:
              "Nearby grocery search is temporarily unavailable.",
          };
        }
      },
    );