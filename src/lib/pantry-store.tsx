import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { useAuth } from "./auth-store";
import { getSupabaseBrowserClient } from "./supabase";
import {
  clearGuestKitchen,
  emptyKitchen,
  readAccountKitchenCache,
  readGuestKitchen,
  writeAccountKitchenCache,
  writeGuestKitchen,
  type PersistedKitchen,
} from "./pantry-persistence";
import { hasKitchenItems, mergeGuestIntoAccount, mergePantryItems } from "./pantry-merge";
import { SupabasePantryRepository } from "./pantry-repository";

export type { ConsumptionEstimate, InventoryEvent, PantryItem } from "./inventory";

export type PantrySyncStatus = "loading" | "guest" | "saved" | "syncing" | "error";

type PantryState = {
  ingredients: string[];
  pantryItems: PantryItem[];
  inventoryEvents: InventoryEvent[];
  preference: MealPreference;
  timeLimit: TimeLimit;
  goals: DietGoal[];
  filters: RecipeFilters;
  syncStatus: PantrySyncStatus;
  syncError: string | null;
  migrationAvailable: boolean;
  addIngredient: (value: string) => void;
  removeIngredient: (value: string) => void;
  setIngredients: (values: string[]) => void;
  clearPantry: () => void;
  setPreference: (value: MealPreference) => void;
  setTimeLimit: (value: TimeLimit) => void;
  toggleGoal: (value: DietGoal) => void;
  setGoals: (values: DietGoal[]) => void;
  loadDemoKitchen: () => void;
  loadScannedKitchen: (items: ScannedPantryItem[]) => void;
  previewConsumption: (recipe: Recipe) => ConsumptionEstimate[];
  applyConsumption: (recipe: Recipe, estimates: ConsumptionEstimate[]) => void;
  saveGuestKitchenToAccount: () => Promise<void>;
  dismissGuestKitchenMigration: () => void;
  retryPantrySync: () => Promise<void>;
};

const PantryContext = createContext<PantryState | null>(null);

function eventId() {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function kitchenSnapshot(
  pantryItems: PantryItem[],
  inventoryEvents: InventoryEvent[],
  preference: MealPreference,
  timeLimit: TimeLimit,
  goals: DietGoal[],
): Omit<PersistedKitchen, "version" | "savedAt"> {
  return { pantryItems, inventoryEvents, preference, timeLimit, goals };
}

function errMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Kitchen sync failed. You can keep cooking and retry.";
}

export function PantryProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [inventoryEvents, setInventoryEvents] = useState<InventoryEvent[]>([]);
  const [preference, setPreferenceState] = useState<MealPreference>("Anything");
  const [timeLimit, setTimeLimitState] = useState<TimeLimit>("No rush");
  const [goals, setGoalsState] = useState<DietGoal[]>([]);
  const [syncStatus, setSyncStatus] = useState<PantrySyncStatus>("loading");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingGuestKitchen, setPendingGuestKitchen] = useState<PersistedKitchen | null>(null);
  const pantryRef = useRef<PantryItem[]>([]);

  useEffect(() => {
    pantryRef.current = pantryItems;
  }, [pantryItems]);

  const persistLocal = useCallback(
    (
      items: PantryItem[],
      events = inventoryEvents,
      pref = preference,
      limit = timeLimit,
      nextGoals = goals,
    ) => {
      const snapshot = kitchenSnapshot(items, events, pref, limit, nextGoals);
      if (userId) writeAccountKitchenCache(userId, snapshot);
      else writeGuestKitchen(snapshot);
    },
    [goals, inventoryEvents, preference, timeLimit, userId],
  );

  const syncAccountItems = useCallback(
    async (items: PantryItem[]) => {
      if (!userId) return;
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      setSyncStatus("syncing");
      setSyncError(null);
      try {
        const repo = new SupabasePantryRepository(supabase, userId);
        const saved = await repo.replaceAll(mergePantryItems(items));
        setPantryItems(saved);
        pantryRef.current = saved;
        writeAccountKitchenCache(
          userId,
          kitchenSnapshot(saved, inventoryEvents, preference, timeLimit, goals),
        );
        setSyncStatus("saved");
      } catch (error) {
        setSyncError(errMessage(error));
        setSyncStatus("error");
      }
    },
    [goals, inventoryEvents, preference, timeLimit, userId],
  );

  const setAndPersistItems = useCallback(
    (updater: (current: PantryItem[]) => PantryItem[]) => {
      setPantryItems((current) => {
        const next = mergePantryItems(updater(current)).map((item) => ({
          ...item,
          updatedAt: item.updatedAt ?? nowIso(),
        }));
        pantryRef.current = next;
        persistLocal(next);
        if (userId) void syncAccountItems(next);
        else setSyncStatus("guest");
        return next;
      });
    },
    [persistLocal, syncAccountItems, userId],
  );

  const hydrateAccount = useCallback(async (id: string) => {
    const cache = readAccountKitchenCache(id);
    setPantryItems(cache.pantryItems);
    pantryRef.current = cache.pantryItems;
    setInventoryEvents(cache.inventoryEvents);
    setPreferenceState(cache.preference);
    setTimeLimitState(cache.timeLimit);
    setGoalsState(cache.goals);
    setSyncStatus("loading");
    setSyncError(null);

    const guest = readGuestKitchen();
    setPendingGuestKitchen(hasKitchenItems(guest.pantryItems) ? guest : null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setSyncStatus("error");
      setSyncError("Supabase is not configured. Using this device's account cache.");
      return;
    }

    try {
      const repo = new SupabasePantryRepository(supabase, id);
      const rows = await repo.list();
      setPantryItems(rows);
      pantryRef.current = rows;
      writeAccountKitchenCache(
        id,
        kitchenSnapshot(
          rows,
          cache.inventoryEvents,
          cache.preference,
          cache.timeLimit,
          cache.goals,
        ),
      );
      setSyncStatus("saved");
    } catch (error) {
      setSyncStatus("error");
      setSyncError(errMessage(error));
    }
  }, []);

  useEffect(() => {
    if (auth.loading) return;
    if (!userId) {
      const guest = readGuestKitchen();
      setPantryItems(guest.pantryItems);
      pantryRef.current = guest.pantryItems;
      setInventoryEvents(guest.inventoryEvents);
      setPreferenceState(guest.preference);
      setTimeLimitState(guest.timeLimit);
      setGoalsState(guest.goals);
      setPendingGuestKitchen(null);
      setSyncError(null);
      setSyncStatus("guest");
      return;
    }
    void hydrateAccount(userId);
  }, [auth.loading, hydrateAccount, userId]);

  useEffect(() => {
    if (auth.loading) return;
    persistLocal(pantryItems, inventoryEvents, preference, timeLimit, goals);
  }, [auth.loading, goals, inventoryEvents, pantryItems, persistLocal, preference, timeLimit]);

  const ingredients = useMemo(
    () => pantryItems.filter((item) => item.quantityEstimate > 0).map((item) => item.name),
    [pantryItems],
  );

  const addInventoryEvents = useCallback((events: InventoryEvent[]) => {
    setInventoryEvents((prev) => [...prev, ...events]);
  }, []);

  const value = useMemo<PantryState>(
    () => ({
      ingredients,
      pantryItems,
      inventoryEvents,
      preference,
      timeLimit,
      goals,
      filters: { preference, timeLimit, goals },
      syncStatus,
      syncError,
      migrationAvailable: Boolean(
        userId && pendingGuestKitchen && hasKitchenItems(pendingGuestKitchen.pantryItems),
      ),
      setPreference: (next: MealPreference) => setPreferenceState(next),
      setTimeLimit: (next: TimeLimit) => setTimeLimitState(next),
      setGoals: (next: DietGoal[]) => setGoalsState(next),
      toggleGoal: (goal: DietGoal) =>
        setGoalsState((prev) =>
          prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
        ),
      setIngredients: (values: string[]) => {
        const clean = values.map((value) => value.trim()).filter(Boolean);
        setAndPersistItems((prev) =>
          clean.map((name) => {
            const existing = prev.find((item) => item.name.toLowerCase() === name.toLowerCase());
            return existing
              ? { ...existing, updatedAt: nowIso() }
              : defaultPantryItem(name, "voice");
          }),
        );
      },
      addIngredient: (raw: string) => {
        const item = raw.trim();
        if (!item) return;
        setAndPersistItems((prev) => [...prev, defaultPantryItem(item, "manual")]);
      },
      removeIngredient: (item: string) =>
        setAndPersistItems((prev) => prev.filter((p) => p.name !== item)),
      clearPantry: () => setAndPersistItems(() => []),
      loadDemoKitchen: () => {
        const stamped = DEMO_PANTRY.map((item) => ({ ...item, updatedAt: nowIso() }));
        setAndPersistItems((prev) => [...prev, ...stamped]);
        addInventoryEvents(
          stamped.map((item) => ({
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
        const scanned = items.map(scannedPantryItem);
        const next = mergePantryItems(scanned);
        setAndPersistItems((prev) => [...prev, ...next]);
        addInventoryEvents(
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
        setAndPersistItems((prev) => deductConsumption(prev, estimates));
        const now = new Date().toISOString();
        addInventoryEvents(
          estimates.map((estimate) => ({
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
        );
      },
      saveGuestKitchenToAccount: async () => {
        if (!userId || !pendingGuestKitchen) return;
        const merged = mergeGuestIntoAccount(pantryRef.current, pendingGuestKitchen.pantryItems);
        setPantryItems(merged);
        pantryRef.current = merged;
        writeAccountKitchenCache(
          userId,
          kitchenSnapshot(merged, inventoryEvents, preference, timeLimit, goals),
        );
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          setSyncStatus("error");
          setSyncError("Supabase is not configured. Guest kitchen was not cleared.");
          return;
        }
        setSyncStatus("syncing");
        try {
          const repo = new SupabasePantryRepository(supabase, userId);
          const saved = await repo.replaceAll(merged);
          setPantryItems(saved);
          pantryRef.current = saved;
          clearGuestKitchen();
          setPendingGuestKitchen(null);
          writeAccountKitchenCache(
            userId,
            kitchenSnapshot(saved, inventoryEvents, preference, timeLimit, goals),
          );
          setSyncStatus("saved");
          setSyncError(null);
        } catch (error) {
          setSyncStatus("error");
          setSyncError(errMessage(error));
        }
      },
      dismissGuestKitchenMigration: () => setPendingGuestKitchen(null),
      retryPantrySync: async () => {
        if (userId) await syncAccountItems(pantryRef.current);
      },
    }),
    [
      addInventoryEvents,
      goals,
      ingredients,
      inventoryEvents,
      pantryItems,
      pendingGuestKitchen,
      preference,
      setAndPersistItems,
      syncAccountItems,
      syncError,
      syncStatus,
      timeLimit,
      userId,
    ],
  );

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>;
}

export function usePantry() {
  const ctx = useContext(PantryContext);
  if (!ctx) throw new Error("usePantry must be used inside PantryProvider");
  return ctx;
}
