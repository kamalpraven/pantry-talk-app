import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DietGoal, MealPreference, RecipeFilters, TimeLimit } from "./recipes";

type PantryState = {
  ingredients: string[];
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
};

const PantryContext = createContext<PantryState | null>(null);
const STORAGE_KEY = "pantrytalk:state";

export function PantryProvider({ children }: { children: ReactNode }) {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [preference, setPreference] = useState<MealPreference>("Anything");
  const [timeLimit, setTimeLimit] = useState<TimeLimit>("No rush");
  const [goals, setGoals] = useState<DietGoal[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        ingredients: string[];
        preference: MealPreference;
        timeLimit: TimeLimit;
        goals: DietGoal[];
      }>;
      if (parsed.ingredients?.length) setIngredients(parsed.ingredients);
      if (parsed.preference) setPreference(parsed.preference);
      if (parsed.timeLimit) setTimeLimit(parsed.timeLimit);
      if (parsed.goals?.length) setGoals(parsed.goals);
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ingredients, preference, timeLimit, goals }),
      );
    } catch {
      // storage unavailable
    }
  }, [ingredients, preference, timeLimit, goals]);

  const value = useMemo<PantryState>(
    () => ({
      ingredients,
      preference,
      timeLimit,
      goals,
      filters: { preference, timeLimit, goals },
      setIngredients,
      setPreference,
      setTimeLimit,
      setGoals,
      toggleGoal: (goal: DietGoal) =>
        setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal])),
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
    [ingredients, preference, timeLimit, goals],
  );

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}

export function usePantry() {
  const ctx = useContext(PantryContext);
  if (!ctx) throw new Error("usePantry must be used inside PantryProvider");
  return ctx;
}
