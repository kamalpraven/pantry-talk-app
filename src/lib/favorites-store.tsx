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
import { favoriteSnapshot } from "./recipe-snapshots";
import {
  clearGuestFavorites,
  emptyFavoritesData,
  readAccountFavoritesCache,
  readGuestFavorites,
  writeAccountFavoritesCache,
  writeGuestFavorites,
  type FavoriteRecipe,
  type FavoritesData,
  type RecipeCollection,
} from "./favorites-persistence";
import {
  removeLocalFavorite,
  sanitizeCollectionName,
  SupabaseFavoritesRepository,
  upsertLocalFavorite,
} from "./favorites-repository";

export type FavoritesState = {
  favorites: FavoriteRecipe[];
  collections: RecipeCollection[];
  memberships: FavoritesData["memberships"];
  loading: boolean;
  error: string | null;
  migrationAvailable: boolean;
  isSaved: (recipeId: string) => boolean;
  favoriteFor: (recipeId: string) => FavoriteRecipe | undefined;
  saveRecipe: (recipe: Recipe) => Promise<void>;
  removeRecipe: (recipeId: string) => Promise<void>;
  createCollection: (name: string) => Promise<void>;
  renameCollection: (collectionId: string, name: string) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
  addToCollection: (collectionId: string, recipeId: string) => Promise<void>;
  removeFromCollection: (collectionId: string, recipeId: string) => Promise<void>;
  migrateGuestFavorites: () => Promise<void>;
  dismissMigration: () => void;
  retry: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesState | null>(null);

function message(error: unknown) {
  return error instanceof Error ? error.message : "Saved recipes sync failed.";
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [data, setData] = useState<FavoritesData>(emptyFavoritesData());
  const [pendingGuest, setPendingGuest] = useState<FavoritesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback(
    (next: FavoritesData) => {
      if (userId) writeAccountFavoritesCache(userId, next);
      else writeGuestFavorites(next);
    },
    [userId],
  );

  const hydrate = useCallback(async () => {
    if (auth.loading) return;
    setLoading(true);
    setError(null);
    if (!userId) {
      setData(readGuestFavorites());
      setPendingGuest(null);
      setLoading(false);
      return;
    }
    const cache = readAccountFavoritesCache(userId);
    setData(cache);
    const guest = readGuestFavorites();
    setPendingGuest(guest.favorites.length ? guest : null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const repo = new SupabaseFavoritesRepository(supabase, userId);
      const remote = await repo.list();
      setData(remote);
      writeAccountFavoritesCache(userId, remote);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, [auth.loading, userId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const repo = useCallback(() => {
    if (!userId) return null;
    const supabase = getSupabaseBrowserClient();
    return supabase ? new SupabaseFavoritesRepository(supabase, userId) : null;
  }, [userId]);

  const value = useMemo<FavoritesState>(
    () => ({
      favorites: data.favorites,
      collections: data.collections,
      memberships: data.memberships,
      loading,
      error,
      migrationAvailable: Boolean(userId && pendingGuest?.favorites.length),
      isSaved: (recipeId: string) =>
        data.favorites.some((favorite) => favorite.recipeId === recipeId),
      favoriteFor: (recipeId: string) =>
        data.favorites.find((favorite) => favorite.recipeId === recipeId),
      saveRecipe: async (recipe: Recipe) => {
        const snapshot = favoriteSnapshot(recipe);
        const optimistic = upsertLocalFavorite(data, recipe.id, snapshot);
        setData(optimistic);
        persist(optimistic);
        trackEvent("recipe_saved", { recipeId: recipe.id });
        const remote = repo();
        if (!remote) return;
        try {
          const saved = await remote.saveFavorite(recipe.id, snapshot);
          const next = {
            ...optimistic,
            favorites: [
              saved,
              ...optimistic.favorites.filter((favorite) => favorite.recipeId !== saved.recipeId),
            ],
          };
          setData(next);
          persist(next);
        } catch (err) {
          setError(message(err));
        }
      },
      removeRecipe: async (recipeId: string) => {
        const previous = data;
        const optimistic = removeLocalFavorite(data, recipeId);
        setData(optimistic);
        persist(optimistic);
        trackEvent("recipe_unsaved", { recipeId });
        const remote = repo();
        if (!remote) return;
        try {
          await remote.removeFavorite(recipeId);
        } catch (err) {
          setError(message(err));
          setData(previous);
          persist(previous);
        }
      },
      createCollection: async (name: string) => {
        const clean = sanitizeCollectionName(name);
        const remote = repo();
        if (!remote) {
          const now = new Date().toISOString();
          const next = {
            ...data,
            collections: [
              ...data.collections,
              {
                id: `guest-col-${Date.now()}`,
                name: clean,
                slug: clean.toLowerCase(),
                isSystem: false,
                createdAt: now,
                updatedAt: now,
              },
            ],
          };
          setData(next);
          persist(next);
          return;
        }
        try {
          const collection = await remote.createCollection(clean);
          const next = {
            ...data,
            collections: [
              ...data.collections.filter((item) => item.id !== collection.id),
              collection,
            ],
          };
          setData(next);
          persist(next);
          trackEvent("collection_created");
        } catch (err) {
          setError(message(err));
        }
      },
      renameCollection: async (collectionId: string, name: string) => {
        const clean = sanitizeCollectionName(name);
        const next = {
          ...data,
          collections: data.collections.map((item) =>
            item.id === collectionId
              ? { ...item, name: clean, updatedAt: new Date().toISOString() }
              : item,
          ),
        };
        setData(next);
        persist(next);
        const remote = repo();
        if (remote)
          try {
            await remote.renameCollection(collectionId, clean);
          } catch (err) {
            setError(message(err));
          }
      },
      deleteCollection: async (collectionId: string) => {
        const next = {
          ...data,
          collections: data.collections.filter((item) => item.id !== collectionId),
          memberships: data.memberships.filter((item) => item.collectionId !== collectionId),
        };
        setData(next);
        persist(next);
        const remote = repo();
        if (remote)
          try {
            await remote.deleteCollection(collectionId);
          } catch (err) {
            setError(message(err));
          }
      },
      addToCollection: async (collectionId: string, recipeId: string) => {
        const favorite = data.favorites.find((item) => item.recipeId === recipeId);
        if (!favorite) return;
        if (
          data.memberships.some(
            (item) => item.collectionId === collectionId && item.favoriteRecipeId === favorite.id,
          )
        )
          return;
        const membership = {
          id: `mem-${collectionId}-${favorite.id}`,
          collectionId,
          favoriteRecipeId: favorite.id,
          createdAt: new Date().toISOString(),
        };
        const next = { ...data, memberships: [...data.memberships, membership] };
        setData(next);
        persist(next);
        const remote = repo();
        if (remote)
          try {
            const saved = await remote.addToCollection(collectionId, favorite.id);
            const merged = {
              ...next,
              memberships: next.memberships.map((item) =>
                item.id === membership.id ? saved : item,
              ),
            };
            setData(merged);
            persist(merged);
          } catch (err) {
            setError(message(err));
          }
      },
      removeFromCollection: async (collectionId: string, recipeId: string) => {
        const favorite = data.favorites.find((item) => item.recipeId === recipeId);
        if (!favorite) return;
        const next = {
          ...data,
          memberships: data.memberships.filter(
            (item) =>
              !(item.collectionId === collectionId && item.favoriteRecipeId === favorite.id),
          ),
        };
        setData(next);
        persist(next);
        const remote = repo();
        if (remote)
          try {
            await remote.removeFromCollection(collectionId, favorite.id);
          } catch (err) {
            setError(message(err));
          }
      },
      migrateGuestFavorites: async () => {
        if (!userId || !pendingGuest) return;
        const remote = repo();
        if (!remote) return;
        try {
          const migrated = await remote.replaceAllFromMigration(pendingGuest);
          setData(migrated);
          writeAccountFavoritesCache(userId, migrated);
          clearGuestFavorites();
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

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}
