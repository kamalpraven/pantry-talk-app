import avocadoEggToast from "@/assets/avocado-egg-toast.jpg";
import cheesyTomatoOmelette from "@/assets/cheesy-tomato-omelette.jpg";
import eggSaladSandwich from "@/assets/egg-salad-sandwich.jpg";
import shakshukaEggs from "@/assets/shakshuka-eggs.jpg";
import tomatoCheddarToast from "@/assets/tomato-cheddar-toast.jpg";

/**
 * Mock recipe layer.
 *
 * Later this module is the single swap point for Linkup live recipe discovery:
 * replace `findRecipes()` with a server function that queries Linkup and maps
 * results into the same `Recipe` shape (including `sourceUrl` / `sourceName`,
 * which are optional today).
 */

export type MealPreference =
  | "Anything"
  | "Quick"
  | "High Protein"
  | "Healthy"
  | "Breakfast"
  | "Lunch"
  | "Dinner";

export const MEAL_PREFERENCES: MealPreference[] = [
  "Anything",
  "Quick",
  "High Protein",
  "Healthy",
  "Breakfast",
  "Lunch",
  "Dinner",
];

export type TimeLimit = "Under 15 min" | "Under 30 min" | "No rush";

export const TIME_LIMITS: TimeLimit[] = ["Under 15 min", "Under 30 min", "No rush"];

export const TIME_LIMIT_MINUTES: Record<TimeLimit, number> = {
  "Under 15 min": 15,
  "Under 30 min": 30,
  "No rush": Number.POSITIVE_INFINITY,
};

export type DietGoal = "High Protein" | "Vegetarian" | "Low Carb" | "Dairy Free" | "Gluten Free";

export const DIET_GOALS: DietGoal[] = [
  "High Protein",
  "Vegetarian",
  "Low Carb",
  "Dairy Free",
  "Gluten Free",
];

/** Assumed to always be in the kitchen — never counted as missing. */
export const ASSUMED_STAPLES = [
  "Olive oil",
  "Salt",
  "Black pepper",
  "Water",
  "Dried spices",
];

const STAPLE_MATCHERS = [
  "oil",
  "salt",
  "pepper",
  "water",
  "spice",
  "spices",
  "paprika",
  "cumin",
  "chili flakes",
  "herbs",
];

export function isStaple(ingredient: string) {
  const value = normalize(ingredient);
  return STAPLE_MATCHERS.some((s) => value.includes(s));
}

export function normalize(value: string) {
  return value.trim().toLowerCase().replace(/e?s$/, "");
}

/** Estimated per serving — not clinical data. Later supplied by Linkup results. */
export type Nutrition = {
  calories: number;
  protein: number;
};

export type Recipe = {
  id: string;
  name: string;
  image: string;
  timeMinutes: number;
  servings: number;
  blurb: string;
  tags: MealPreference[];
  dietaryTags: DietGoal[];
  nutrition: Nutrition;
  /** Key (non-staple) ingredients the dish needs. */
  keyIngredients: string[];
  /** Ingredients the dish is defined by — never offered a substitution. */
  essentialIngredients: string[];
  staples: string[];
  steps: string[];
  /** Reserved for Linkup live discovery. */
  sourceUrl?: string;
  sourceName?: string;
};

/** Practical swaps — suggestions, never guaranteed equivalents. */
export const SUBSTITUTIONS: Record<string, string> = {
  mayonnaise: "Greek yogurt + a squeeze of lemon",
  "sour cream": "Greek yogurt",
  lemon: "A splash of vinegar",
  cheddar: "Any melting cheese, like gouda or mozzarella",
  bread: "A tortilla, pita or bagel",
  onion: "Shallot, leek or spring onion",
  tomatoe: "Canned chopped tomatoes",
  avocado: "Hummus, for a different but creamy spread",
  egg: "Firm tofu, scrambled",
};

export type Substitution = {
  missing: string;
  suggestion: string;
};

export function substitutionFor(recipe: Recipe, missing: string): Substitution | null {
  const essential = recipe.essentialIngredients.some(
    (item) => normalize(item) === normalize(missing),
  );
  if (essential) return null;
  const suggestion = SUBSTITUTIONS[normalize(missing)];
  return suggestion ? { missing, suggestion } : null;
}

export const RECIPES: Recipe[] = [
  {
    id: "avocado-egg-toast",
    name: "Avocado Egg Toast",
    image: avocadoEggToast,
    timeMinutes: 15,
    servings: 2,
    blurb: "Creamy lemony avocado on toast with a soft egg on top.",
    tags: ["Quick", "Healthy", "Breakfast", "High Protein"],
    dietaryTags: ["High Protein", "Vegetarian", "Dairy Free"],
    nutrition: { calories: 430, protein: 21 },
    keyIngredients: ["Avocado", "Eggs", "Bread", "Lemon", "Tomatoes"],
    essentialIngredients: ["Avocado", "Eggs"],
    staples: ["Salt", "Black pepper", "Olive oil"],
    steps: [
      "Bring a small pot of water to a gentle simmer and toast two slices of bread until golden.",
      "Mash the avocado with lemon juice, salt and black pepper until creamy but still chunky.",
      "Lower the eggs into the simmering water and cook 6 minutes for a soft, jammy yolk.",
      "Spread the mashed avocado thickly over the warm toast.",
      "Peel the eggs carefully, halve them and lay them on top with sliced tomato.",
      "Finish with a drizzle of olive oil, a pinch of salt and plenty of cracked pepper.",
    ],
  },
  {
    id: "cheesy-tomato-omelette",
    name: "Cheesy Tomato Omelette",
    image: cheesyTomatoOmelette,
    timeMinutes: 12,
    servings: 1,
    blurb: "Soft folded omelette with melted cheddar and blistered tomatoes.",
    tags: ["Quick", "High Protein", "Breakfast", "Lunch"],
    dietaryTags: ["High Protein", "Vegetarian", "Low Carb", "Gluten Free"],
    nutrition: { calories: 390, protein: 28 },
    keyIngredients: ["Eggs", "Cheddar", "Tomatoes"],
    essentialIngredients: ["Eggs", "Cheddar"],
    staples: ["Olive oil", "Salt", "Black pepper"],
    steps: [
      "Beat three eggs with a pinch of salt and pepper until fully combined.",
      "Warm a little olive oil in a non-stick pan over medium heat.",
      "Add the halved tomatoes and cook 2 minutes until they soften and blister.",
      "Pour in the eggs and swirl the pan, drawing the edges inward as they set.",
      "Scatter grated cheddar over one half while the top is still slightly wet.",
      "Fold the omelette over the cheese, slide onto a plate and rest 1 minute before eating.",
    ],
  },
  {
    id: "egg-salad-sandwich",
    name: "Egg Salad Sandwich",
    image: eggSaladSandwich,
    timeMinutes: 20,
    servings: 2,
    blurb: "Cool, creamy egg salad brightened with lemon on toasted bread.",
    tags: ["Lunch", "High Protein"],
    dietaryTags: ["High Protein", "Vegetarian", "Dairy Free"],
    nutrition: { calories: 480, protein: 22 },
    keyIngredients: ["Eggs", "Bread", "Lemon", "Mayonnaise"],
    essentialIngredients: ["Eggs"],
    staples: ["Salt", "Black pepper"],
    steps: [
      "Hard boil four eggs for 9 minutes, then cool them under cold running water.",
      "Peel and roughly chop the eggs into a bowl.",
      "Fold in mayonnaise, a squeeze of lemon, salt and black pepper.",
      "Toast the bread lightly so it holds the filling without going soggy.",
      "Pile the egg salad onto the bread, close the sandwich and slice in half.",
    ],
  },
  {
    id: "shakshuka-style-eggs",
    name: "Shakshuka-Style Eggs",
    image: shakshukaEggs,
    timeMinutes: 25,
    servings: 2,
    blurb: "Eggs poached in a spiced tomato sauce, scooped up with bread.",
    tags: ["Dinner", "High Protein", "Healthy"],
    dietaryTags: ["Vegetarian", "Dairy Free"],
    nutrition: { calories: 350, protein: 19 },
    keyIngredients: ["Tomatoes", "Eggs", "Bread", "Onion"],
    essentialIngredients: ["Tomatoes", "Eggs"],
    staples: ["Olive oil", "Dried spices", "Salt", "Black pepper"],
    steps: [
      "Warm olive oil in a skillet and soften the sliced onion for 5 minutes.",
      "Stir in your dried spices — paprika and cumin work well — and cook 30 seconds.",
      "Add the chopped tomatoes with a splash of water, salt and pepper.",
      "Simmer 10 minutes until the sauce thickens and darkens slightly.",
      "Make small wells in the sauce and crack an egg into each one.",
      "Cover and cook 6 minutes until the whites are set, then serve with toasted bread.",
    ],
  },
  {
    id: "tomato-cheddar-breakfast-toast",
    name: "Tomato Cheddar Breakfast Toast",
    image: tomatoCheddarToast,
    timeMinutes: 10,
    servings: 1,
    blurb: "Grilled cheddar and tomato on toast — the fastest thing you can make.",
    tags: ["Quick", "Breakfast", "Lunch"],
    dietaryTags: ["Vegetarian"],
    nutrition: { calories: 330, protein: 14 },
    keyIngredients: ["Bread", "Tomatoes", "Cheddar"],
    essentialIngredients: ["Bread", "Cheddar"],
    staples: ["Olive oil", "Salt", "Black pepper"],
    steps: [
      "Heat the grill or a toaster oven to high.",
      "Toast the bread on one side only, then flip it over.",
      "Layer thick tomato slices over the untoasted side and season with salt and pepper.",
      "Cover generously with grated cheddar.",
      "Grill 3 to 4 minutes until the cheese bubbles and browns at the edges.",
    ],
  },
];

export type RecipeFilters = {
  preference: MealPreference;
  timeLimit: TimeLimit;
  goals: DietGoal[];
};

export type RecipeMatch = {
  recipe: Recipe;
  used: string[];
  missing: string[];
  matchPercent: number;
  substitutions: Substitution[];
  /** Up to two labels worth showing on a card. */
  labels: DietGoal[];
  reason: string;
  fitsTime: boolean;
};

export function matchRecipe(recipe: Recipe, pantry: string[]) {
  const owned = pantry.map(normalize);
  const used: string[] = [];
  const missing: string[] = [];

  for (const item of recipe.keyIngredients) {
    if (isStaple(item)) continue;
    if (owned.includes(normalize(item))) used.push(item);
    else missing.push(item);
  }

  const total = used.length + missing.length || 1;
  const matchPercent = Math.round((used.length / total) * 100);
  const substitutions = missing
    .map((item) => substitutionFor(recipe, item))
    .filter((s): s is Substitution => s !== null);

  return { recipe, used, missing, matchPercent, substitutions };
}

function buildReason(
  base: ReturnType<typeof matchRecipe>,
  pantry: string[],
  filters: RecipeFilters,
  fitsTime: boolean,
  isTopProtein: boolean,
): string {
  const { recipe, used, missing, substitutions } = base;
  const limit = TIME_LIMIT_MINUTES[filters.timeLimit];

  if (filters.goals.includes("High Protein") && isTopProtein && fitsTime) {
    return `Highest-protein option at ${recipe.nutrition.protein}g per serving that still fits your time limit.`;
  }
  if (used.length && missing.length === 0) {
    return `Uses ${used.length} of your ${pantry.length} ingredients and needs nothing extra, in ${recipe.timeMinutes} minutes.`;
  }
  if (used.length && fitsTime && Number.isFinite(limit)) {
    return `Uses ${used.length} of your ${pantry.length} ingredients and comes in under your ${limit}-minute target.`;
  }
  if (missing.length === 1 && substitutions.length === 1) {
    return `Uses ${used.length} of your ingredients — and you can swap the ${missing[0]?.toLowerCase()}.`;
  }
  if (used.length) {
    return `Uses ${used.length} of your ${pantry.length} ingredients and takes only ${recipe.timeMinutes} minutes.`;
  }
  return `A simple ${recipe.timeMinutes}-minute dish worth keeping in mind.`;
}

export function findRecipes(pantry: string[], filters: RecipeFilters): RecipeMatch[] {
  const limit = TIME_LIMIT_MINUTES[filters.timeLimit];
  const base = RECIPES.map((recipe) => matchRecipe(recipe, pantry));

  const qualifying = base.filter((m) => m.recipe.timeMinutes <= limit);
  const topProtein = qualifying
    .slice()
    .sort((a, b) => b.recipe.nutrition.protein - a.recipe.nutrition.protein)[0];

  const matches: RecipeMatch[] = base.map((m) => {
    const fitsTime = m.recipe.timeMinutes <= limit;
    const labels = filters.goals.length
      ? m.recipe.dietaryTags.filter((t) => filters.goals.includes(t)).slice(0, 2)
      : m.recipe.dietaryTags.slice(0, 2);
    return {
      ...m,
      fitsTime,
      labels,
      reason: buildReason(
        m,
        pantry,
        filters,
        fitsTime,
        topProtein?.recipe.id === m.recipe.id,
      ),
    };
  });

  const goalScore = (m: RecipeMatch) =>
    filters.goals.filter((g) => m.recipe.dietaryTags.includes(g)).length;

  return matches.sort((a, b) => {
    if (a.fitsTime !== b.fitsTime) return a.fitsTime ? -1 : 1;
    if (goalScore(b) !== goalScore(a)) return goalScore(b) - goalScore(a);
    if (filters.goals.includes("High Protein")) {
      const p = b.recipe.nutrition.protein - a.recipe.nutrition.protein;
      if (p !== 0) return p;
    }
    const prefScore = (m: RecipeMatch) =>
      filters.preference === "Anything" ? 0 : m.recipe.tags.includes(filters.preference) ? 1 : 0;
    if (prefScore(b) !== prefScore(a)) return prefScore(b) - prefScore(a);
    if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
    return a.recipe.timeMinutes - b.recipe.timeMinutes;
  });
}

export function getRecipe(id: string) {
  return RECIPES.find((r) => r.id === id);
}

export function readinessLabel(missing: string[]) {
  if (missing.length === 0) return "Ready now";
  if (missing.length === 1) return "Missing 1 ingredient";
  return `Missing ${missing.length} ingredients`;
}

export function substituteLabel(count: number) {
  return count === 1 ? "1 easy substitute" : `${count} easy substitutes`;
}

/** Detects an explicit time in a cooking step, e.g. "cook 4 minutes". */
export function stepTimerSeconds(step: string): number | null {
  const words: Record<string, number> = {
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
    fifteen: 15,
    twenty: 20,
    thirty: 30,
  };
  const pattern =
    /(\d+)\s*(?:to|–|-)?\s*(\d+)?\s*(minute|minutes|min|mins|second|seconds|sec|secs)\b/i;
  const match = pattern.exec(step);
  if (match) {
    const value = Number(match[2] ?? match[1]);
    const unit = (match[3] ?? "").toLowerCase();
    if (!value) return null;
    return unit.startsWith("sec") ? value : value * 60;
  }
  const wordPattern = new RegExp(
    `\\b(${Object.keys(words).join("|")})\\s*(minute|minutes|second|seconds)\\b`,
    "i",
  );
  const wordMatch = wordPattern.exec(step);
  if (wordMatch) {
    const value = words[(wordMatch[1] ?? "").toLowerCase()];
    if (!value) return null;
    return (wordMatch[2] ?? "").toLowerCase().startsWith("sec") ? value : value * 60;
  }
  return null;
}

export function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function timerLabel(seconds: number) {
  if (seconds % 60 === 0) {
    const m = seconds / 60;
    return `Start ${m}-minute timer`;
  }
  return `Start ${seconds}-second timer`;
}
