import { describe, expect, it, vi, beforeEach } from "vitest";
import { RECIPES } from "./recipes";
import { favoriteSnapshot, cookingSnapshot, recipeFromCookingSnapshot } from "./recipe-snapshots";
import { cleanFavoritesData, favoriteLocalId } from "./favorites-persistence";
import {
  removeLocalFavorite,
  sanitizeCollectionName,
  upsertLocalFavorite,
} from "./favorites-repository";
import {
  cleanHistoryData,
  emptyHistoryData,
  migrationKeyForSession,
  validateDuration,
  validateRating,
  validateServings,
} from "./cooking-history-persistence";
import { memoryForRecipe } from "./recipe-memory";

class MemoryStorage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

beforeEach(() => vi.stubGlobal("window", { localStorage: new MemoryStorage() as Storage }));

describe("favorites domain", () => {
  it("saves, unsaves, and prevents duplicates", () => {
    const recipe = RECIPES[0]!;
    const first = upsertLocalFavorite(cleanFavoritesData({}), recipe.id, favoriteSnapshot(recipe));
    const second = upsertLocalFavorite(first, recipe.id, favoriteSnapshot(recipe));
    expect(second.favorites).toHaveLength(1);
    expect(removeLocalFavorite(second, recipe.id).favorites).toHaveLength(0);
  });

  it("keeps favorite after collection deletion semantics", () => {
    const recipe = RECIPES[0]!;
    const fav = {
      id: favoriteLocalId(recipe.id),
      recipeId: recipe.id,
      recipeSnapshot: favoriteSnapshot(recipe),
      createdAt: new Date().toISOString(),
    };
    const data = cleanFavoritesData({
      favorites: [fav],
      collections: [{ id: "c1", name: "Weeknight" }],
      memberships: [{ collectionId: "c1", favoriteRecipeId: fav.id }],
    });
    const afterDelete = {
      ...data,
      collections: [],
      memberships: data.memberships.filter((item) => item.collectionId !== "c1"),
    };
    expect(afterDelete.favorites).toHaveLength(1);
    expect(afterDelete.memberships).toHaveLength(0);
  });

  it("allows favorite in multiple collections", () => {
    const recipe = RECIPES[0]!;
    const fav = {
      id: favoriteLocalId(recipe.id),
      recipeId: recipe.id,
      recipeSnapshot: favoriteSnapshot(recipe),
      createdAt: new Date().toISOString(),
    };
    const data = cleanFavoritesData({
      favorites: [fav],
      collections: [
        { id: "c1", name: "Weeknight" },
        { id: "c2", name: "High Protein" },
      ],
      memberships: [
        { collectionId: "c1", favoriteRecipeId: fav.id },
        { collectionId: "c2", favoriteRecipeId: fav.id },
      ],
    });
    expect(data.memberships).toHaveLength(2);
  });

  it("rejects invalid collection names", () => {
    expect(() => sanitizeCollectionName("   ")).toThrow();
    expect(sanitizeCollectionName("  Meal Prep  ")).toBe("Meal Prep");
  });
});

describe("history domain", () => {
  it("validates rating, servings, and duration", () => {
    expect(validateRating(5)).toBe(5);
    expect(() => validateRating(6)).toThrow();
    expect(validateServings(4)).toBe(4);
    expect(() => validateServings(0)).toThrow();
    expect(validateDuration(30)).toBe(30);
    expect(() => validateDuration(2000)).toThrow();
  });

  it("deduplicates migrated sessions by migration key", () => {
    const recipe = RECIPES[0]!;
    const session = {
      id: "s1",
      recipeId: recipe.id,
      recipeSnapshot: cookingSnapshot(recipe),
      startedAt: "2026-01-01T00:00:00.000Z",
      status: "completed",
    };
    const cleaned = cleanHistoryData({ sessions: [session, { ...session, id: "s2" }] });
    expect(cleaned.sessions).toHaveLength(2);
    const withKey = cleanHistoryData({
      sessions: [
        { ...session, migrationKey: "same" },
        { ...session, id: "s2", migrationKey: "same" },
      ],
    });
    expect(withKey.sessions).toHaveLength(1);
    expect(migrationKeyForSession(withKey.sessions[0]!)).toBe("same");
  });

  it("computes recipe memory", () => {
    const recipe = RECIPES[0]!;
    const data = emptyHistoryData();
    data.sessions = [
      {
        id: "s1",
        recipeId: recipe.id,
        recipeSnapshot: cookingSnapshot(recipe),
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:20:00.000Z",
        status: "completed",
        servings: 4,
        actualMinutes: 20,
        rating: 5,
        wouldCookAgain: "yes",
        notes: null,
        finishedPhotoUrl: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:20:00.000Z",
      },
      {
        id: "s2",
        recipeId: recipe.id,
        recipeSnapshot: cookingSnapshot(recipe),
        startedAt: "2026-01-02T00:00:00.000Z",
        completedAt: "2026-01-02T00:20:00.000Z",
        status: "completed",
        servings: 4,
        actualMinutes: 20,
        rating: 4,
        wouldCookAgain: "yes",
        notes: null,
        finishedPhotoUrl: null,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:20:00.000Z",
      },
    ];
    data.substitutions = [
      {
        id: "sub1",
        cookingSessionId: "s2",
        originalIngredient: "Spinach",
        replacementIngredient: "Kale",
        createdAt: "2026-01-02T00:10:00.000Z",
      },
    ];
    const memory = memoryForRecipe(data, recipe.id);
    expect(memory.cookedCount).toBe(2);
    expect(memory.lastRating).toBe(4);
    expect(memory.usualServings).toBe(4);
    expect(memory.lastSubstitution?.replacementIngredient).toBe("Kale");
  });
});

describe("snapshots", () => {
  it("creates compact and durable snapshots", () => {
    const recipe = RECIPES[0]!;
    expect(favoriteSnapshot(recipe).steps).toBeUndefined();
    const durable = cookingSnapshot(recipe);
    expect(durable.steps.length).toBeGreaterThan(0);
    expect(recipeFromCookingSnapshot(durable).steps).toEqual(recipe.steps);
  });
});
