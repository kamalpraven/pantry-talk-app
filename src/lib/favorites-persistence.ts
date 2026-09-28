import type { FavoriteRecipeSnapshot } from "./recipe-snapshots";

export const GUEST_FAVORITES_KEY = "pantrytalk.guest-favorites.v1";
const ACCOUNT_FAVORITES_PREFIX = "pantrytalk.account-favorites-cache.v1:";
export const MAX_GUEST_FAVORITES = 50;
export const MAX_COLLECTIONS = 30;

export type FavoriteRecipe = {
  id: string;
  recipeId: string;
  recipeSnapshot: FavoriteRecipeSnapshot | null;
  createdAt: string;
};

export type RecipeCollection = {
  id: string;
  name: string;
  slug: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CollectionRecipe = {
  id: string;
  collectionId: string;
  favoriteRecipeId: string;
  createdAt: string;
};

export type FavoritesData = {
  version: 1;
  favorites: FavoriteRecipe[];
  collections: RecipeCollection[];
  memberships: CollectionRecipe[];
  savedAt: string;
};

export function emptyFavoritesData(): FavoritesData {
  return {
    version: 1,
    favorites: [],
    collections: [],
    memberships: [],
    savedAt: new Date(0).toISOString(),
  };
}

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

export function favoriteLocalId(recipeId: string) {
  return `fav-${recipeId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

export function collectionLocalId(name: string) {
  return `col-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
}

function cleanFavorite(raw: unknown): FavoriteRecipe | null {
  if (!isRecord(raw)) return null;
  const recipeId = typeof raw["recipeId"] === "string" ? raw["recipeId"].trim().slice(0, 200) : "";
  if (!recipeId) return null;
  return {
    id: typeof raw["id"] === "string" && raw["id"] ? raw["id"] : favoriteLocalId(recipeId),
    recipeId,
    recipeSnapshot: isRecord(raw["recipeSnapshot"])
      ? (raw["recipeSnapshot"] as FavoriteRecipeSnapshot)
      : null,
    createdAt: typeof raw["createdAt"] === "string" ? raw["createdAt"] : new Date().toISOString(),
  };
}

function cleanCollection(raw: unknown): RecipeCollection | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw["name"] === "string" ? raw["name"].trim().slice(0, 60) : "";
  if (!name) return null;
  return {
    id: typeof raw["id"] === "string" && raw["id"] ? raw["id"] : collectionLocalId(name),
    name,
    slug: typeof raw["slug"] === "string" ? raw["slug"] : null,
    isSystem: Boolean(raw["isSystem"]),
    createdAt: typeof raw["createdAt"] === "string" ? raw["createdAt"] : new Date().toISOString(),
    updatedAt: typeof raw["updatedAt"] === "string" ? raw["updatedAt"] : new Date().toISOString(),
  };
}

function cleanMembership(raw: unknown): CollectionRecipe | null {
  if (!isRecord(raw)) return null;
  const collectionId = typeof raw["collectionId"] === "string" ? raw["collectionId"] : "";
  const favoriteRecipeId =
    typeof raw["favoriteRecipeId"] === "string" ? raw["favoriteRecipeId"] : "";
  if (!collectionId || !favoriteRecipeId) return null;
  return {
    id:
      typeof raw["id"] === "string" && raw["id"]
        ? raw["id"]
        : `mem-${collectionId}-${favoriteRecipeId}`,
    collectionId,
    favoriteRecipeId,
    createdAt: typeof raw["createdAt"] === "string" ? raw["createdAt"] : new Date().toISOString(),
  };
}

export function cleanFavoritesData(raw: unknown): FavoritesData {
  if (!isRecord(raw)) return emptyFavoritesData();
  const favorites = Array.isArray(raw["favorites"])
    ? raw["favorites"].map(cleanFavorite).filter((item): item is FavoriteRecipe => item !== null)
    : [];
  const uniqueFavorites = [
    ...new Map(favorites.map((favorite) => [favorite.recipeId, favorite])).values(),
  ].slice(-MAX_GUEST_FAVORITES);
  const collections = Array.isArray(raw["collections"])
    ? raw["collections"]
        .map(cleanCollection)
        .filter((item): item is RecipeCollection => item !== null)
        .slice(0, MAX_COLLECTIONS)
    : [];
  const favoriteIds = new Set(uniqueFavorites.map((favorite) => favorite.id));
  const collectionIds = new Set(collections.map((collection) => collection.id));
  const memberships = Array.isArray(raw["memberships"])
    ? raw["memberships"]
        .map(cleanMembership)
        .filter(
          (item): item is CollectionRecipe =>
            item !== null &&
            favoriteIds.has(item.favoriteRecipeId) &&
            collectionIds.has(item.collectionId),
        )
    : [];
  const uniqueMemberships = [
    ...new Map(
      memberships.map((membership) => [
        `${membership.collectionId}:${membership.favoriteRecipeId}`,
        membership,
      ]),
    ).values(),
  ];
  return {
    version: 1,
    favorites: uniqueFavorites,
    collections,
    memberships: uniqueMemberships,
    savedAt: typeof raw["savedAt"] === "string" ? raw["savedAt"] : new Date().toISOString(),
  };
}

function readKey(key: string): FavoritesData {
  const area = storage();
  if (!area) return emptyFavoritesData();
  try {
    const raw = area.getItem(key);
    return raw ? cleanFavoritesData(JSON.parse(raw)) : emptyFavoritesData();
  } catch {
    return emptyFavoritesData();
  }
}

function writeKey(key: string, data: FavoritesData) {
  const area = storage();
  if (!area) return;
  try {
    area.setItem(
      key,
      JSON.stringify({ ...cleanFavoritesData(data), savedAt: new Date().toISOString() }),
    );
  } catch {
    // storage unavailable
  }
}

export function readGuestFavorites() {
  return readKey(GUEST_FAVORITES_KEY);
}
export function writeGuestFavorites(data: FavoritesData) {
  writeKey(GUEST_FAVORITES_KEY, data);
}
export function clearGuestFavorites() {
  try {
    storage()?.removeItem(GUEST_FAVORITES_KEY);
  } catch {
    // ignore unavailable storage
  }
}
export function accountFavoritesCacheKey(userId: string) {
  return `${ACCOUNT_FAVORITES_PREFIX}${userId}`;
}
export function readAccountFavoritesCache(userId: string) {
  return readKey(accountFavoritesCacheKey(userId));
}
export function writeAccountFavoritesCache(userId: string, data: FavoritesData) {
  writeKey(accountFavoritesCacheKey(userId), data);
}
