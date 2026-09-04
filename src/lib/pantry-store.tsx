import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MealPreference } from "./recipes";

type PantryState = {
  ingredients: string[];
  preference: MealPreference;
  addIngredient: (value: string) => void;
  removeIngredient: (value: string) => void;
  setIngredients: (values: string[]) => void;
  setPreference: (value: MealPreference) => void;
};

const PantryContext = createContext<PantryState | null>(null);
const STORAGE_KEY = "pantrytalk:state";

export function PantryProvider({ children }: { children: ReactNode }) {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [preference, setPreference] = useState<MealPreference>("Anything");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        ingredients: string[];
        preference: MealPreference;
      }>;
      if (parsed.ingredients?.length) setIngredients(parsed.ingredients);
      if (parsed.preference) setPreference(parsed.preference);
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ingredients, preference }));
    } catch {
      // storage unavailable
    }
  }, [ingredients, preference]);

  const value = useMemo<PantryState>(
    () => ({
      ingredients,
      preference,
      setIngredients,
      setPreference,
      addIngredient: (raw: string) => {
        const item = raw.trim();
        if (!item) return;
        setIngredients((prev) =>
          prev.some((p) => p.toLowerCase() === item.toLowerCase()) ? prev : [...prev, item],
        );
      },
      removeIngredient: (item: string) =>
        setIngredients((prev) => prev.filter((p) => p !== item)),
    }),
    [ingredients, preference],
  );

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}

export function usePantry() {
  const ctx = useContext(PantryContext);
  if (!ctx) throw new Error("usePantry must be used inside PantryProvider");
  return ctx;
}
