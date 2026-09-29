import { describe, expect, it } from "vitest";
import { findRecipes, MAKE_NOW_MATCH_THRESHOLD, type Recipe, type RecipeFilters } from "./recipes";

const filters: RecipeFilters = {
  preference: "Anything",
  timeLimit: "No rush",
  goals: [],
};

function recipe(id: string, keyIngredients: string[], timeMinutes = 20): Recipe {
  return {
    id,
    name: id,
    image: "",
    timeMinutes,
    servings: 2,
    blurb: "Test recipe",
    tags: ["Dinner"],
    dietaryTags: [],
    nutrition: { calories: 300, protein: 20 },
    keyIngredients,
    essentialIngredients: keyIngredients.slice(0, 1),
    staples: [],
    steps: ["Cook it."],
  };
}

describe("findRecipes Make Now threshold", () => {
  it("includes recipes at exactly 70% pantry coverage", () => {
    const matches = findRecipes(["a", "b", "c", "d", "e", "f", "g"], filters, [
      recipe("seventy", ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]),
    ]);

    expect(MAKE_NOW_MATCH_THRESHOLD).toBe(70);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.matchPercent).toBe(70);
  });

  it("excludes recipes below 70% pantry coverage", () => {
    const matches = findRecipes(["a", "b"], filters, [recipe("sixty-seven", ["a", "b", "c"])]);

    expect(matches).toEqual([]);
  });

  it("sorts qualifying recipes from highest to lowest pantry match", () => {
    const matches = findRecipes(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"], filters, [
      recipe("eighty", ["a", "b", "c", "d", "e", "f", "g", "h", "x", "y"]),
      recipe("hundred", ["a", "b", "c"]),
      recipe("seventy", ["a", "b", "c", "d", "e", "f", "g", "x", "y", "z"]),
    ]);

    expect(matches.map((match) => match.recipe.id)).toEqual(["hundred", "eighty", "seventy"]);
    expect(matches.map((match) => match.matchPercent)).toEqual([100, 80, 70]);
  });

  it("ranks recipes that satisfy an Under 30 time limit above higher pantry matches that do not", () => {
    const matches = findRecipes(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "p", "q", "r"],
      { ...filters, timeLimit: "Under 30 min" },
      [
        recipe("twenty-minute-ninety", ["a", "b", "c", "d", "e", "f", "g", "h", "i", "x"], 20),
        recipe("sixty-minute-hundred", ["p", "q", "r"], 60),
      ],
    );

    expect(matches.map((match) => match.recipe.id)).toEqual([
      "twenty-minute-ninety",
      "sixty-minute-hundred",
    ]);
    expect(matches.map((match) => match.matchPercent)).toEqual([90, 100]);
  });
});
