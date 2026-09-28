import { defaultPantryItem, type InventoryEvent, type PantryItem } from "./inventory";
import type { DietGoal, MealPreference, TimeLimit } from "./recipes";

export const GUEST_KITCHEN_STORAGE_KEY = "pantrytalk.guest-kitchen.v1";
export const OLD_PANTRY_STORAGE_KEY = "pantrytalk:state";
const ACCOUNT_CACHE_PREFIX = "pantrytalk.account-cache.v1:";

export type PersistedKitchen = {
  version: 1;
  pantryItems: PantryItem[];
  inventoryEvents: InventoryEvent[];
  preference: MealPreference;
  timeLimit: TimeLimit;
  goals: DietGoal[];
  savedAt: string;
};

type LegacyKitchen = Partial<{
  pantryItems: PantryItem[];
  inventoryEvents: InventoryEvent[];
  ingredients: string[];
  preference: MealPreference;
  timeLimit: TimeLimit;
  goals: DietGoal[];
}>;

export const emptyKitchen = (): PersistedKitchen => ({
  version: 1,
  pantryItems: [],
  inventoryEvents: [],
  preference: "Anything",
  timeLimit: "No rush",
  goals: [],
  savedAt: new Date(0).toISOString(),
});

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanItem(raw: unknown): PantryItem | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw["name"] === "string" ? raw["name"].trim().slice(0, 80) : "";
  if (!name) return null;
  const unit = ["count", "g", "ml", "portion"].includes(String(raw["unit"]))
    ? (String(raw["unit"]) as PantryItem["unit"])
    : "portion";
  const source = ["manual", "voice", "demo", "scan", "cook", "correction"].includes(
    String(raw["source"]),
  )
    ? (String(raw["source"]) as PantryItem["source"])
    : "manual";
  const quantity = Number(raw["quantityEstimate"]);
  const confidence = Number(raw["confidence"]);
  const useSoon = Number(raw["useSoonDays"]);
  const updatedAt = typeof raw["updatedAt"] === "string" ? raw["updatedAt"] : undefined;
  return {
    id: typeof raw["id"] === "string" && raw["id"] ? raw["id"] : defaultPantryItem(name).id,
    name,
    quantityEstimate: Number.isFinite(quantity) ? Math.max(0, Math.min(quantity, 100000)) : 1,
    unit,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(confidence, 1)) : 0.7,
    source,
    ...(Number.isFinite(useSoon)
      ? { useSoonDays: Math.max(0, Math.min(365, Math.round(useSoon))) }
      : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function cleanKitchen(raw: unknown): PersistedKitchen | null {
  if (!isRecord(raw)) return null;
  const pantryItems = Array.isArray(raw["pantryItems"])
    ? raw["pantryItems"].map(cleanItem).filter((item): item is PantryItem => item !== null)
    : Array.isArray(raw["ingredients"])
      ? raw["ingredients"]
          .filter((item): item is string => typeof item === "string")
          .map((name) => defaultPantryItem(name, "manual"))
      : [];
  const inventoryEvents = Array.isArray(raw["inventoryEvents"])
    ? (raw["inventoryEvents"].filter(isRecord) as unknown as InventoryEvent[])
    : [];
  return {
    version: 1,
    pantryItems,
    inventoryEvents,
    preference:
      typeof raw["preference"] === "string" ? (raw["preference"] as MealPreference) : "Anything",
    timeLimit: typeof raw["timeLimit"] === "string" ? (raw["timeLimit"] as TimeLimit) : "No rush",
    goals: Array.isArray(raw["goals"]) ? (raw["goals"].filter(Boolean) as DietGoal[]) : [],
    savedAt: typeof raw["savedAt"] === "string" ? raw["savedAt"] : new Date(0).toISOString(),
  };
}

function readJson(key: string): unknown | null {
  const area = storage();
  if (!area) return null;
  const raw = area.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: PersistedKitchen) {
  const area = storage();
  if (!area) return;
  try {
    area.setItem(key, JSON.stringify({ ...value, savedAt: new Date().toISOString() }));
  } catch {
    // storage may be unavailable or full
  }
}

export function readGuestKitchen(): PersistedKitchen {
  const current = cleanKitchen(readJson(GUEST_KITCHEN_STORAGE_KEY));
  if (current) return current;

  // Backward-compatible hydration only. Do not remove or rewrite the old key here,
  // because it may contain unrelated preference state from Milestone 1.
  const legacy = cleanKitchen(readJson(OLD_PANTRY_STORAGE_KEY) as LegacyKitchen | null);
  return legacy ?? emptyKitchen();
}

export function writeGuestKitchen(kitchen: Omit<PersistedKitchen, "version" | "savedAt">) {
  writeJson(GUEST_KITCHEN_STORAGE_KEY, {
    ...kitchen,
    version: 1,
    savedAt: new Date().toISOString(),
  });
}

export function clearGuestKitchen() {
  const area = storage();
  if (!area) return;
  try {
    area.removeItem(GUEST_KITCHEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function accountCacheKey(userId: string) {
  return `${ACCOUNT_CACHE_PREFIX}${userId}`;
}

export function readAccountKitchenCache(userId: string): PersistedKitchen {
  return cleanKitchen(readJson(accountCacheKey(userId))) ?? emptyKitchen();
}

export function writeAccountKitchenCache(
  userId: string,
  kitchen: Omit<PersistedKitchen, "version" | "savedAt">,
) {
  writeJson(accountCacheKey(userId), {
    ...kitchen,
    version: 1,
    savedAt: new Date().toISOString(),
  });
}
