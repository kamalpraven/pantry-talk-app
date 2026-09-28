import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPantryItem } from "./inventory";
import {
  GUEST_KITCHEN_STORAGE_KEY,
  OLD_PANTRY_STORAGE_KEY,
  accountCacheKey,
  clearGuestKitchen,
  readAccountKitchenCache,
  readGuestKitchen,
  writeAccountKitchenCache,
  writeGuestKitchen,
} from "./pantry-persistence";
import { pantryItemToInsert } from "./pantry-repository";

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

function installStorage() {
  const localStorage = new MemoryStorage() as Storage;
  vi.stubGlobal("window", { localStorage });
  return localStorage;
}

describe("pantry persistence", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists and hydrates guest pantry", () => {
    installStorage();
    writeGuestKitchen({
      pantryItems: [defaultPantryItem("chicken")],
      inventoryEvents: [],
      preference: "Dinner",
      timeLimit: "Under 30 min",
      goals: ["High Protein"],
    });

    const hydrated = readGuestKitchen();
    expect(hydrated.pantryItems[0]?.name).toBe("chicken");
    expect(hydrated.preference).toBe("Dinner");
  });

  it("handles malformed guest storage gracefully", () => {
    const storage = installStorage();
    storage.setItem(GUEST_KITCHEN_STORAGE_KEY, "not json");

    expect(readGuestKitchen().pantryItems).toEqual([]);
  });

  it("hydrates old pantry state without destroying unrelated old preference state", () => {
    const storage = installStorage();
    storage.setItem(
      OLD_PANTRY_STORAGE_KEY,
      JSON.stringify({ ingredients: ["carrots"], unrelatedPreference: "keep-me" }),
    );

    expect(readGuestKitchen().pantryItems[0]?.name).toBe("carrots");
    clearGuestKitchen();
    expect(storage.getItem(OLD_PANTRY_STORAGE_KEY)).toContain("keep-me");
  });

  it("keeps authenticated fallback caches separated per user", () => {
    const storage = installStorage();
    writeAccountKitchenCache("user-a", {
      pantryItems: [defaultPantryItem("milk")],
      inventoryEvents: [],
      preference: "Anything",
      timeLimit: "No rush",
      goals: [],
    });
    writeAccountKitchenCache("user-b", {
      pantryItems: [defaultPantryItem("eggs")],
      inventoryEvents: [],
      preference: "Anything",
      timeLimit: "No rush",
      goals: [],
    });

    expect(accountCacheKey("user-a")).not.toBe(accountCacheKey("user-b"));
    expect(readAccountKitchenCache("user-a").pantryItems[0]?.name).toBe("milk");
    expect(readAccountKitchenCache("user-b").pantryItems[0]?.name).toBe("eggs");
  });

  it("builds authenticated rows from the provided auth-context user id", () => {
    const row = pantryItemToInsert(defaultPantryItem("Mushrooms"), "auth-user-id");
    expect(row?.user_id).toBe("auth-user-id");
    expect(row?.normalized_name).toBe("mushroom");
    expect(row?.id).toBeUndefined();
  });
});
