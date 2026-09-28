import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DietGoal, MealPreference, Recipe, RecipeFilters, TimeLimit } from "./recipes";
import {
  applyConsumption as deductConsumption,
  defaultPantryItem,
  DEMO_PANTRY,
  estimateRecipeConsumption,
  scannedPantryItem,
  type ConsumptionEstimate,
  type InventoryEvent,
  type PantryItem,
  type ScannedPantryItem,
} from "./inventory";

export type { ConsumptionEstimate, InventoryEvent, PantryItem } from "./inventory";

type PantryState = {
  ingredients: string[];
  pantryItems: PantryItem[];
  inventoryEvents: InventoryEvent[];
  preference: MealPreference;
  timeLimit: TimeLimit;
  goals: DietGoal[];
  filters: RecipeFilters;
  addIngredient: (value: string) => void;
  removeIngredient: (value: string) => void;
  setIngredients: (values: string[]) => void;
  setPreference: (value: MealPreference) => void;
  setTimeLimit: (value: TimeLimit) => void;
  toggleGoal: (value: DietGoal) => void;
  setGoals: (values: DietGoal[]) => void;
  loadDemoKitchen: () => void;
  loadScannedKitchen: (items: ScannedPantryItem[]) => void;
  previewConsumption: (recipe: Recipe) => ConsumptionEstimate[];
  applyConsumption: (recipe: Recipe, estimates: ConsumptionEstimate[]) => void;
};

const PantryContext = createContext<PantryState | null>(null);
const STORAGE_KEY = "pantrytalk:state";

function eventId() {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PantryProvider({ children }: { children: ReactNode }) {
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [inventoryEvents, setInventoryEvents] = useState<InventoryEvent[]>([]);
  const [preference, setPreference] = useState<MealPreference>("Anything");
  const [timeLimit, setTimeLimit] = useState<TimeLimit>("No rush");
  const [goals, setGoals] = useState<DietGoal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<{
          pantryItems: PantryItem[];
          inventoryEvents: InventoryEvent[];
          ingredients: string[];
          preference: MealPreference;
          timeLimit: TimeLimit;
          goals: DietGoal[];
        }>;

        if (parsed.pantryItems?.length) {
          setPantryItems(parsed.pantryItems);
        } else if (parsed.ingredients?.length) {
          setPantryItems(parsed.ingredients.map((name) => defaultPantryItem(name, "manual")));
        }
        if (parsed.inventoryEvents?.length) setInventoryEvents(parsed.inventoryEvents);
        if (parsed.preference) setPreference(parsed.preference);
        if (parsed.timeLimit) setTimeLimit(parsed.timeLimit);
        if (parsed.goals?.length) setGoals(parsed.goals);
      }
    } catch {
      // ignore malformed storage
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pantryItems, inventoryEvents, preference, timeLimit, goals, version: 2 }),
      );
    } catch {
      // storage unavailable
    }
  }, [pantryItems, inventoryEvents, preference, timeLimit, goals, loaded]);

  const ingredients = useMemo(
    () => pantryItems.filter((item) => item.quantityEstimate > 0).map((item) => item.name),
    [pantryItems],
  );

  const value = useMemo<PantryState>(
    () => ({
      ingredients,
      pantryItems,
      inventoryEvents,
      preference,
      timeLimit,
      goals,
      filters: { preference, timeLimit, goals },
      setPreference,
      setTimeLimit,
      setGoals,
      toggleGoal: (goal: DietGoal) =>
        setGoals((prev) =>
          prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
        ),
      setIngredients: (values: string[]) => {
        const clean = values.map((value) => value.trim()).filter(Boolean);
        setPantryItems((prev) =>
          clean.map((name) => {
            const existing = prev.find((item) => item.name.toLowerCase() === name.toLowerCase());
            return existing ?? defaultPantryItem(name, "voice");
          }),
        );
      },
      addIngredient: (raw: string) => {
        const item = raw.trim();
        if (!item) return;
        setPantryItems((prev) =>
          prev.some((p) => p.name.toLowerCase() === item.toLowerCase())
            ? prev
            : [...prev, defaultPantryItem(item, "manual")],
        );
      },
      removeIngredient: (item: string) =>
        setPantryItems((prev) => prev.filter((p) => p.name !== item)),
      loadDemoKitchen: () => {
        const next = DEMO_PANTRY.map((item) => ({ ...item }));
        setPantryItems(next);
        setInventoryEvents(
          next.map((item) => ({
            id: eventId(),
            pantryItemId: item.id,
            pantryItemName: item.name,
            type: "ADD" as const,
            quantityChange: item.quantityEstimate,
            unit: item.unit,
            confidence: item.confidence,
            source: "demo" as const,
            createdAt: new Date().toISOString(),
          })),
        );
      },
      loadScannedKitchen: (items: ScannedPantryItem[]) => {
        const next = items
          .map(scannedPantryItem)
          .filter(
            (item, index, all) =>
              all.findIndex(
                (candidate) => candidate.name.toLowerCase() === item.name.toLowerCase(),
              ) === index,
          );
        setPantryItems(next);
        setInventoryEvents(
          next.map((item) => ({
            id: eventId(),
            pantryItemId: item.id,
            pantryItemName: item.name,
            type: "ADD" as const,
            quantityChange: item.quantityEstimate,
            unit: item.unit,
            confidence: item.confidence,
            source: "scan" as const,
            createdAt: new Date().toISOString(),
          })),
        );
      },
      previewConsumption: (recipe: Recipe) => estimateRecipeConsumption(recipe, pantryItems),
      applyConsumption: (recipe: Recipe, estimates: ConsumptionEstimate[]) => {
        setPantryItems((prev) => deductConsumption(prev, estimates));
        const now = new Date().toISOString();
        setInventoryEvents((prev) => [
          ...prev,
          ...estimates.map((estimate) => ({
            id: eventId(),
            pantryItemId: estimate.pantryItemId,
            pantryItemName: estimate.name,
            type: "COOK" as const,
            quantityChange: -Math.abs(estimate.quantity),
            unit: estimate.unit,
            confidence: estimate.confidence,
            source: "cook" as const,
            recipeId: recipe.id,
            createdAt: now,
          })),
        ]);
      },
    }),
    [ingredients, pantryItems, inventoryEvents, preference, timeLimit, goals],
  );

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}

export function usePantry() {
  const ctx = useContext(PantryContext);
  if (!ctx) throw new Error("usePantry must be used inside PantryProvider");
  return ctx;
}
