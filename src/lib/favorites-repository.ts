import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types";
import type {
  CollectionRecipe,
  FavoriteRecipe,
  FavoritesData,
  RecipeCollection,
} from "./favorites-persistence";
import { emptyFavoritesData, favoriteLocalId } from "./favorites-persistence";
import type { FavoriteRecipeSnapshot } from "./recipe-snapshots";

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function sanitizeCollectionName(name: string) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (clean.length < 1) throw new Error("Collection name is required.");
  return clean;
}

export function sanitizeFavoriteSnapshot(snapshot: FavoriteRecipeSnapshot | null): Json | null {
  if (!snapshot) return null;
  const compact = {
    ...snapshot,
    blurb: snapshot.blurb.slice(0, 360),
    keyIngredients: snapshot.keyIngredients.slice(0, 20),
  };
  if (JSON.stringify(compact).length > 8_000) return null;
  return compact as unknown as Json;
}

function favoriteFromRow(
  row: Database["public"]["Tables"]["favorite_recipes"]["Row"],
): FavoriteRecipe {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    recipeSnapshot: row.recipe_snapshot as FavoriteRecipeSnapshot | null,
    createdAt: row.created_at,
  };
}

function collectionFromRow(
  row: Database["public"]["Tables"]["recipe_collections"]["Row"],
): RecipeCollection {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function membershipFromRow(
  row: Database["public"]["Tables"]["collection_recipes"]["Row"],
): CollectionRecipe {
  return {
    id: row.id,
    collectionId: row.collection_id,
    favoriteRecipeId: row.favorite_recipe_id,
    createdAt: row.created_at,
  };
}

export class SupabaseFavoritesRepository {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly userId: string,
  ) {}

  async list(): Promise<FavoritesData> {
    const [favorites, collections, memberships] = await Promise.all([
      this.supabase
        .from("favorite_recipes")
        .select("*")
        .eq("user_id", this.userId)
        .order("created_at", { ascending: false })
        .limit(200),
      this.supabase
        .from("recipe_collections")
        .select("*")
        .eq("user_id", this.userId)
        .order("created_at", { ascending: true })
        .limit(50),
      this.supabase
        .from("collection_recipes")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(500),
    ]);
    if (favorites.error) throw favorites.error;
    if (collections.error) throw collections.error;
    if (memberships.error) throw memberships.error;
    const favoriteIds = new Set((favorites.data ?? []).map((row) => row.id));
    const collectionIds = new Set((collections.data ?? []).map((row) => row.id));
    return {
      ...emptyFavoritesData(),
      favorites: (favorites.data ?? []).map(favoriteFromRow),
      collections: (collections.data ?? []).map(collectionFromRow),
      memberships: (memberships.data ?? [])
        .map(membershipFromRow)
        .filter(
          (row) => favoriteIds.has(row.favoriteRecipeId) && collectionIds.has(row.collectionId),
        ),
      savedAt: new Date().toISOString(),
    };
  }

  async saveFavorite(
    recipeId: string,
    snapshot: FavoriteRecipeSnapshot | null,
  ): Promise<FavoriteRecipe> {
    const { data, error } = await this.supabase
      .from("favorite_recipes")
      .upsert(
        {
          user_id: this.userId,
          recipe_id: recipeId,
          recipe_snapshot: sanitizeFavoriteSnapshot(snapshot),
        },
        { onConflict: "user_id,recipe_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    await this.event(recipeId, "recipe_saved");
    return favoriteFromRow(data);
  }

  async removeFavorite(recipeId: string) {
    const { error } = await this.supabase
      .from("favorite_recipes")
      .delete()
      .eq("user_id", this.userId)
      .eq("recipe_id", recipeId);
    if (error) throw error;
    await this.event(recipeId, "recipe_unsaved");
  }

  async createCollection(name: string): Promise<RecipeCollection> {
    const clean = sanitizeCollectionName(name);
    const { data, error } = await this.supabase
      .from("recipe_collections")
      .upsert(
        { user_id: this.userId, name: clean, slug: slugify(clean), is_system: false },
        { onConflict: "user_id,name" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return collectionFromRow(data);
  }

  async renameCollection(collectionId: string, name: string): Promise<RecipeCollection> {
    const clean = sanitizeCollectionName(name);
    const { data, error } = await this.supabase
      .from("recipe_collections")
      .update({ name: clean, slug: slugify(clean) })
      .eq("id", collectionId)
      .eq("user_id", this.userId)
      .select("*")
      .single();
    if (error) throw error;
    return collectionFromRow(data);
  }

  async deleteCollection(collectionId: string) {
    const { error } = await this.supabase
      .from("recipe_collections")
      .delete()
      .eq("id", collectionId)
      .eq("user_id", this.userId);
    if (error) throw error;
  }

  async addToCollection(collectionId: string, favoriteRecipeId: string): Promise<CollectionRecipe> {
    const { data, error } = await this.supabase
      .from("collection_recipes")
      .upsert(
        { collection_id: collectionId, favorite_recipe_id: favoriteRecipeId },
        { onConflict: "collection_id,favorite_recipe_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return membershipFromRow(data);
  }

  async removeFromCollection(collectionId: string, favoriteRecipeId: string) {
    const { error } = await this.supabase
      .from("collection_recipes")
      .delete()
      .eq("collection_id", collectionId)
      .eq("favorite_recipe_id", favoriteRecipeId);
    if (error) throw error;
  }

  async replaceAllFromMigration(data: FavoritesData): Promise<FavoritesData> {
    const current = await this.list();
    const favoriteByRecipe = new Map(
      current.favorites.map((favorite) => [favorite.recipeId, favorite]),
    );
    for (const favorite of data.favorites) {
      if (!favoriteByRecipe.has(favorite.recipeId)) {
        favoriteByRecipe.set(
          favorite.recipeId,
          await this.saveFavorite(favorite.recipeId, favorite.recipeSnapshot),
        );
      }
    }
    for (const collection of data.collections) await this.createCollection(collection.name);
    return this.list();
  }

  async event(
    recipeId: string,
    eventType: Database["public"]["Tables"]["recipe_events"]["Insert"]["event_type"],
    metadata?: Json,
  ) {
    await this.supabase.from("recipe_events").insert({
      user_id: this.userId,
      recipe_id: recipeId,
      event_type: eventType,
      metadata: metadata ?? null,
    });
  }
}

export function upsertLocalFavorite(
  data: FavoritesData,
  recipeId: string,
  snapshot: FavoriteRecipeSnapshot | null,
): FavoritesData {
  const exists = data.favorites.find((favorite) => favorite.recipeId === recipeId);
  if (exists) {
    return {
      ...data,
      favorites: data.favorites.map((favorite) =>
        favorite.recipeId === recipeId
          ? { ...favorite, recipeSnapshot: favorite.recipeSnapshot ?? snapshot }
          : favorite,
      ),
    };
  }
  return {
    ...data,
    favorites: [
      {
        id: favoriteLocalId(recipeId),
        recipeId,
        recipeSnapshot: snapshot,
        createdAt: new Date().toISOString(),
      },
      ...data.favorites,
    ].slice(0, 50),
  };
}

export function removeLocalFavorite(data: FavoritesData, recipeId: string): FavoritesData {
  const favorite = data.favorites.find((item) => item.recipeId === recipeId);
  if (!favorite) return data;
  return {
    ...data,
    favorites: data.favorites.filter((item) => item.recipeId !== recipeId),
    memberships: data.memberships.filter((item) => item.favoriteRecipeId !== favorite.id),
  };
}
