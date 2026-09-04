import { RECIPES, type Recipe } from "./recipes";

/**
 * Holds the recipes returned by the live Linkup search so the detail and
 * cooking screens can read them after navigation. Falls back to the bundled
 * recipes when live search was unavailable.
 */
const STORAGE_KEY = "pantrytalk:live-recipes";
let memory: Recipe[] = [];

export function cacheRecipes(list: Recipe[]) {
  memory = list;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable — in-memory is enough for this session
  }
}

export function cachedRecipes(): Recipe[] {
  if (memory.length) return memory;
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) memory = JSON.parse(raw) as Recipe[];
  } catch {
    memory = [];
  }
  return memory;
}

export function lookupRecipe(id: string): Recipe | undefined {
  return cachedRecipes().find((r) => r.id === id) ?? RECIPES.find((r) => r.id === id);
}
