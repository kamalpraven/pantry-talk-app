import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-store";
import { getSupabaseBrowserClient } from "./supabase";
import { trackEvent } from "./analytics";
import type { Recipe } from "./recipes";
import { cookingSnapshot } from "./recipe-snapshots";
import {
  clearGuestHistory,
  emptyHistoryData,
  migrationKeyForSession,
  readAccountHistoryCache,
  readGuestHistory,
  sessionLocalId,
  validateDuration,
  validateRating,
  validateServings,
  writeAccountHistoryCache,
  writeGuestHistory,
  type CookingHistoryData,
  type CookingSession,
  type CookingSubstitution,
} from "./cooking-history-persistence";
import {
  SupabaseCookingHistoryRepository,
  type CompleteSessionInput,
} from "./cooking-history-repository";
import { memoryForRecipe, type RecipeMemory } from "./recipe-memory";

export type CookingHistoryState = {
  sessions: CookingSession[];
  substitutions: CookingSubstitution[];
  activeSession: CookingSession | null;
  loading: boolean;
  error: string | null;
  migrationAvailable: boolean;
  startCooking: (
    recipe: Recipe,
    options?: { forceNew?: boolean; servings?: number | null; cookedAgain?: boolean },
  ) => Promise<CookingSession>;
  completeSession: (sessionId: string, input: CompleteSessionInput) => Promise<void>;
  abandonSession: (sessionId: string) => Promise<void>;
  memoryFor: (recipeId: string) => RecipeMemory;
  substitutionsFor: (sessionId: string) => CookingSubstitution[];
  sessionById: (sessionId: string) => CookingSession | undefined;
  migrateGuestHistory: () => Promise<void>;
  dismissMigration: () => void;
  retry: () => Promise<void>;
};

const CookingHistoryContext = createContext<CookingHistoryState | null>(null);
function message(error: unknown) {
  return error instanceof Error ? error.message : "Cooking history sync failed.";
}

export function CookingHistoryProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [data, setData] = useState<CookingHistoryData>(emptyHistoryData());
  const [pendingGuest, setPendingGuest] = useState<CookingHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback(
    (next: CookingHistoryData) => {
      if (userId) writeAccountHistoryCache(userId, next);
      else writeGuestHistory(next);
    },
    [userId],
  );
  const repo = useCallback(() => {
    if (!userId) return null;
    const supabase = getSupabaseBrowserClient();
    return supabase ? new SupabaseCookingHistoryRepository(supabase, userId) : null;
  }, [userId]);

  const hydrate = useCallback(async () => {
    if (auth.loading) return;
    setLoading(true);
    setError(null);
    if (!userId) {
      setData(readGuestHistory());
      setPendingGuest(null);
      setLoading(false);
      return;
    }
    const cache = readAccountHistoryCache(userId);
    setData(cache);
    const guest = readGuestHistory();
    setPendingGuest(guest.sessions.length ? guest : null);
    const remote = repo();
    if (!remote) {
      setLoading(false);
      return;
    }
    try {
      const loaded = await remote.list(60);
      setData(loaded);
      writeAccountHistoryCache(userId, loaded);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [auth.loading, repo, userId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const value = useMemo<CookingHistoryState>(
    () => ({
      sessions: data.sessions,
      substitutions: data.substitutions,
      activeSession:
        data.sessions.find((session) => session.id === data.activeSessionId) ??
        data.sessions.find((session) => session.status === "active") ??
        null,
      loading,
      error,
      migrationAvailable: Boolean(userId && pendingGuest?.sessions.length),
      startCooking: async (recipe, options) => {
        const snapshot = cookingSnapshot(recipe);
        const existing = !options?.forceNew
          ? data.sessions.find(
              (session) => session.recipeId === recipe.id && session.status === "active",
            )
          : undefined;
        if (existing) return existing;
        const now = new Date().toISOString();
        const local: CookingSession = {
          id: sessionLocalId(recipe.id),
          recipeId: recipe.id,
          recipeSnapshot: snapshot,
          startedAt: now,
          completedAt: null,
          status: "active",
          servings: validateServings(options?.servings ?? recipe.servings),
          actualMinutes: null,
          rating: null,
          wouldCookAgain: null,
          notes: null,
          finishedPhotoUrl: null,
          createdAt: now,
          updatedAt: now,
          migrationKey: `${recipe.id}:${now}`,
        };
        const optimistic = {
          ...data,
          sessions: [local, ...data.sessions].slice(0, 25),
          activeSessionId: local.id,
        };
        setData(optimistic);
        persist(optimistic);
        trackEvent(options?.cookedAgain ? "cook_again_started" : "cook_started", {
          recipeId: recipe.id,
        });
        const remote = repo();
        if (!remote) return local;
        try {
          const saved = await remote.start(recipe.id, snapshot, local.servings, local.migrationKey);
          if (options?.cookedAgain) await remote.event(recipe.id, "recipe_cooked_again");
          const next = {
            ...optimistic,
            sessions: optimistic.sessions.map((session) =>
              session.id === local.id ? saved : session,
            ),
            activeSessionId: saved.id,
          };
          setData(next);
          persist(next);
          return saved;
        } catch (err) {
          setError(message(err));
          return local;
        }
      },
      completeSession: async (sessionId, input) => {
        validateRating(input.rating);
        validateServings(input.servings);
        validateDuration(input.actualMinutes);
        const existing = data.sessions.find((session) => session.id === sessionId);
        if (!existing) return;
        const completedAt = new Date().toISOString();
        const actualMinutes =
          input.actualMinutes ??
          Math.max(0, Math.round((Date.now() - Date.parse(existing.startedAt)) / 60000));
        const updated: CookingSession = {
          ...existing,
          status: "completed",
          completedAt,
          rating: input.rating ?? null,
          wouldCookAgain: input.wouldCookAgain ?? null,
          notes: input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null,
          servings: input.servings ?? existing.servings,
          actualMinutes,
          updatedAt: completedAt,
        };
        const subs = (input.substitutions ?? [])
          .filter((item) => item.originalIngredient.trim() && item.replacementIngredient.trim())
          .slice(0, 20)
          .map((item, index) => ({
            id: `sub-${sessionId}-${index}`,
            cookingSessionId: sessionId,
            originalIngredient: item.originalIngredient.trim().slice(0, 80),
            replacementIngredient: item.replacementIngredient.trim().slice(0, 80),
            createdAt: completedAt,
          }));
        const optimistic = {
          ...data,
          sessions: data.sessions.map((session) => (session.id === sessionId ? updated : session)),
          substitutions: [
            ...data.substitutions.filter((sub) => sub.cookingSessionId !== sessionId),
            ...subs,
          ],
          activeSessionId: data.activeSessionId === sessionId ? null : data.activeSessionId,
        };
        setData(optimistic);
        persist(optimistic);
        trackEvent("cook_completed", { recipeId: existing.recipeId });
        if (input.rating)
          trackEvent("recipe_rated", { recipeId: existing.recipeId, rating: input.rating });
        const remote = repo();
        if (remote)
          try {
            await remote.complete(sessionId, input);
            void hydrate();
          } catch (err) {
            setError(message(err));
          }
      },
      abandonSession: async (sessionId) => {
        const existing = data.sessions.find((session) => session.id === sessionId);
        if (!existing) return;
        const next = {
          ...data,
          sessions: data.sessions.map((session) =>
            session.id === sessionId
              ? { ...session, status: "abandoned" as const, updatedAt: new Date().toISOString() }
              : session,
          ),
          activeSessionId: data.activeSessionId === sessionId ? null : data.activeSessionId,
        };
        setData(next);
        persist(next);
        const remote = repo();
        if (remote)
          try {
            await remote.abandon(sessionId);
          } catch (err) {
            setError(message(err));
          }
      },
      memoryFor: (recipeId) => memoryForRecipe(data, recipeId),
      substitutionsFor: (sessionId) =>
        data.substitutions.filter((sub) => sub.cookingSessionId === sessionId),
      sessionById: (sessionId) => data.sessions.find((session) => session.id === sessionId),
      migrateGuestHistory: async () => {
        if (!userId || !pendingGuest) return;
        const remote = repo();
        if (!remote) return;
        try {
          const normalized = {
            ...pendingGuest,
            sessions: pendingGuest.sessions.map((session) => ({
              ...session,
              migrationKey: migrationKeyForSession(session),
            })),
          };
          const migrated = await remote.migrate(normalized);
          setData(migrated);
          writeAccountHistoryCache(userId, migrated);
          clearGuestHistory();
          setPendingGuest(null);
        } catch (err) {
          setError(message(err));
        }
      },
      dismissMigration: () => setPendingGuest(null),
      retry: hydrate,
    }),
    [data, error, hydrate, loading, pendingGuest, persist, repo, userId],
  );

  return <CookingHistoryContext.Provider value={value}>{children}</CookingHistoryContext.Provider>;
}

export function useCookingHistory() {
  const ctx = useContext(CookingHistoryContext);
  if (!ctx) throw new Error("useCookingHistory must be used inside CookingHistoryProvider");
  return ctx;
}
