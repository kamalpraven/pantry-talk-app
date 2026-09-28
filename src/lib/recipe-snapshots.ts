import { lookupRecipe } from "./recipe-cache";
import type { Nutrition, Recipe } from "./recipes";

export type FavoriteRecipeSnapshot = {
  id: string;
  name: string;
  image?: string;
  imageUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
  timeMinutes: number;
  servings: number;
  blurb: string;
  keyIngredients: string[];
  nutrition: Nutrition;
};

export type CookingRecipeSnapshot = FavoriteRecipeSnapshot & {
  ingredientLines?: string[];
  steps: string[];
  staples: string[];
};

const MAX_FAVORITE_SNAPSHOT_BYTES = 8_000;
const MAX_COOKING_SNAPSHOT_BYTES = 24_000;

function jsonBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function favoriteSnapshot(recipe: Recipe): FavoriteRecipeSnapshot {
  const snapshot: FavoriteRecipeSnapshot = {
    id: recipe.id,
    name: recipe.name,
    image: recipe.image,
    imageUrl: recipe.imageUrl,
    sourceName: recipe.sourceName,
    sourceUrl: recipe.sourceUrl,
    timeMinutes: recipe.timeMinutes,
    servings: recipe.servings,
    blurb: recipe.blurb,
    keyIngredients: recipe.keyIngredients.slice(0, 20),
    nutrition: recipe.nutrition,
  };
  if (jsonBytes(snapshot) > MAX_FAVORITE_SNAPSHOT_BYTES) {
    return {
      ...snapshot,
      blurb: snapshot.blurb.slice(0, 240),
      keyIngredients: snapshot.keyIngredients.slice(0, 10),
    };
  }
  return snapshot;
}

export function cookingSnapshot(recipe: Recipe): CookingRecipeSnapshot {
  const snapshot: CookingRecipeSnapshot = {
    ...favoriteSnapshot(recipe),
    ingredientLines: recipe.ingredientLines?.slice(0, 40),
    steps: recipe.steps.slice(0, 60),
    staples: recipe.staples.slice(0, 20),
  };
  if (jsonBytes(snapshot) > MAX_COOKING_SNAPSHOT_BYTES) {
    return {
      ...snapshot,
      blurb: snapshot.blurb.slice(0, 240),
      ingredientLines: snapshot.ingredientLines?.slice(0, 25),
      steps: snapshot.steps.slice(0, 40).map((step) => step.slice(0, 500)),
    };
  }
  return snapshot;
}

export function recipeFromCookingSnapshot(snapshot: CookingRecipeSnapshot): Recipe {
  return {
    id: snapshot.id,
    name: snapshot.name,
    image: snapshot.image ?? snapshot.imageUrl ?? "",
    imageUrl: snapshot.imageUrl,
    sourceName: snapshot.sourceName,
    sourceUrl: snapshot.sourceUrl,
    timeMinutes: snapshot.timeMinutes,
    servings: snapshot.servings,
    blurb: snapshot.blurb,
    tags: ["Anything"],
    dietaryTags: [],
    nutrition: snapshot.nutrition,
    keyIngredients: snapshot.keyIngredients,
    essentialIngredients: snapshot.keyIngredients.slice(0, 2),
    staples: snapshot.staples ?? [],
    ingredientLines: snapshot.ingredientLines,
    steps: snapshot.steps,
  };
}

export function lookupRecipeWithSnapshot(
  recipeId: string,
  snapshot?: CookingRecipeSnapshot | FavoriteRecipeSnapshot | null,
): Recipe | undefined {
  const canonical = lookupRecipe(recipeId);
  if (canonical) return canonical;
  if (snapshot && "steps" in snapshot) return recipeFromCookingSnapshot(snapshot);
  return undefined;
}
