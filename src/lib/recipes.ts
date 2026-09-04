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
 * results into the same `Recipe` shape.
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

export type Recipe = {
  id: string;
  name: string;
  image: string;
  timeMinutes: number;
  servings: number;
  blurb: string;
  tags: MealPreference[];
  /** Key (non-staple) ingredients the dish needs. */
  keyIngredients: string[];
  staples: string[];
  steps: string[];
};

export const RECIPES: Recipe[] = [
  {
    id: "avocado-egg-toast",
    name: "Avocado Egg Toast",
    image: avocadoEggToast,
    timeMinutes: 15,
    servings: 2,
    blurb: "Creamy lemony avocado on toast with a soft egg on top.",
    tags: ["Quick", "Healthy", "Breakfast", "High Protein"],
    keyIngredients: ["Avocado", "Eggs", "Bread", "Lemon", "Tomatoes"],
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
    keyIngredients: ["Eggs", "Cheddar", "Tomatoes"],
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
    keyIngredients: ["Eggs", "Bread", "Lemon", "Mayonnaise"],
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
    keyIngredients: ["Tomatoes", "Eggs", "Bread", "Onion"],
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
    keyIngredients: ["Bread", "Tomatoes", "Cheddar"],
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

export type RecipeMatch = {
  recipe: Recipe;
  used: string[];
  missing: string[];
  matchPercent: number;
};

export function matchRecipe(recipe: Recipe, pantry: string[]): RecipeMatch {
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

  return { recipe, used, missing, matchPercent };
}

export function findRecipes(pantry: string[], preference: MealPreference): RecipeMatch[] {
  const matches = RECIPES.map((recipe) => matchRecipe(recipe, pantry));

  return matches.sort((a, b) => {
    const prefScore = (m: RecipeMatch) =>
      preference === "Anything" ? 0 : m.recipe.tags.includes(preference) ? 1 : 0;
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
