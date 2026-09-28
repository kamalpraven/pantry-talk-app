import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types";
import type { CookingRecipeSnapshot } from "./recipe-snapshots";
import {
  emptyHistoryData,
  migrationKeyForSession,
  validateDuration,
  validateRating,
  validateServings,
  type CookingHistoryData,
  type CookingSession,
  type CookingStatus,
  type CookingSubstitution,
  type WouldCookAgain,
} from "./cooking-history-persistence";

function sanitizeText(value: string, limit = 2000) {
  return value.trim().slice(0, limit);
}
function snapshotJson(snapshot: CookingRecipeSnapshot | null): Json | null {
  if (!snapshot) return null;
  if (JSON.stringify(snapshot).length > 24_000) return null;
  return snapshot as unknown as Json;
}
function wouldToBoolean(value: WouldCookAgain): boolean | null {
  return value === "yes" ? true : value === "no" ? false : null;
}
function booleanToWould(value: boolean | null): WouldCookAgain {
  return value === true ? "yes" : value === false ? "no" : null;
}

function sessionFromRow(
  row: Database["public"]["Tables"]["cooking_sessions"]["Row"],
): CookingSession {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    recipeSnapshot: row.recipe_snapshot as CookingRecipeSnapshot | null,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status as CookingStatus,
    servings: row.servings,
    actualMinutes: row.actual_minutes,
    rating: row.rating,
    wouldCookAgain: booleanToWould(row.would_cook_again),
    notes: row.notes,
    finishedPhotoUrl: row.finished_photo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    migrationKey: row.migration_key ?? undefined,
  };
}

function substitutionFromRow(
  row: Database["public"]["Tables"]["cooking_substitutions"]["Row"],
): CookingSubstitution {
  return {
    id: row.id,
    cookingSessionId: row.cooking_session_id,
    originalIngredient: row.original_ingredient,
    replacementIngredient: row.replacement_ingredient,
    createdAt: row.created_at,
  };
}

export type CompleteSessionInput = {
  rating?: number | null;
  wouldCookAgain?: WouldCookAgain;
  notes?: string | null;
  actualMinutes?: number | null;
  servings?: number | null;
  substitutions?: { originalIngredient: string; replacementIngredient: string }[];
};

export class SupabaseCookingHistoryRepository {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly userId: string,
  ) {}

  async list(limit = 50): Promise<CookingHistoryData> {
    const sessions = await this.supabase
      .from("cooking_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .order("started_at", { ascending: false })
      .limit(limit);
    if (sessions.error) throw sessions.error;
    const ids = (sessions.data ?? []).map((row) => row.id);
    const substitutions = ids.length
      ? await this.supabase
          .from("cooking_substitutions")
          .select("*")
          .in("cooking_session_id", ids)
          .order("created_at", { ascending: true })
      : { data: [], error: null };
    if (substitutions.error) throw substitutions.error;
    const mapped = (sessions.data ?? []).map(sessionFromRow);
    return {
      ...emptyHistoryData(),
      sessions: mapped,
      substitutions: (substitutions.data ?? []).map(substitutionFromRow),
      activeSessionId: mapped.find((session) => session.status === "active")?.id ?? null,
      savedAt: new Date().toISOString(),
    };
  }

  async start(
    recipeId: string,
    snapshot: CookingRecipeSnapshot | null,
    servings: number | null,
    migrationKey?: string,
  ): Promise<CookingSession> {
    if (migrationKey) {
      const existing = await this.supabase
        .from("cooking_sessions")
        .select("*")
        .eq("user_id", this.userId)
        .eq("migration_key", migrationKey)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return sessionFromRow(existing.data);
    } else {
      const existing = await this.supabase
        .from("cooking_sessions")
        .select("*")
        .eq("user_id", this.userId)
        .eq("recipe_id", recipeId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return sessionFromRow(existing.data);
    }
    const { data, error } = await this.supabase
      .from("cooking_sessions")
      .insert({
        user_id: this.userId,
        recipe_id: recipeId,
        recipe_snapshot: snapshotJson(snapshot),
        status: "active",
        servings: validateServings(servings),
        migration_key: migrationKey ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    await this.event(recipeId, "cook_started");
    return sessionFromRow(data);
  }

  async complete(sessionId: string, input: CompleteSessionInput): Promise<CookingSession> {
    const existing = await this.supabase
      .from("cooking_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", this.userId)
      .single();
    if (existing.error) throw existing.error;
    const started = Date.parse(existing.data.started_at);
    const actualMinutes = validateDuration(
      input.actualMinutes ??
        (Number.isFinite(started) ? Math.max(0, Math.round((Date.now() - started) / 60000)) : null),
    );
    const { data, error } = await this.supabase
      .from("cooking_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        rating: validateRating(input.rating),
        would_cook_again: wouldToBoolean(input.wouldCookAgain ?? null),
        notes: input.notes ? sanitizeText(input.notes) : null,
        actual_minutes: actualMinutes,
        servings: validateServings(input.servings),
      })
      .eq("id", sessionId)
      .eq("user_id", this.userId)
      .select("*")
      .single();
    if (error) throw error;
    if (input.substitutions?.length)
      await this.replaceSubstitutions(sessionId, input.substitutions);
    await this.event(data.recipe_id, "cook_completed");
    if (input.rating) await this.event(data.recipe_id, "recipe_rated", { rating: input.rating });
    return sessionFromRow(data);
  }

  async abandon(sessionId: string): Promise<CookingSession> {
    const { data, error } = await this.supabase
      .from("cooking_sessions")
      .update({ status: "abandoned" })
      .eq("id", sessionId)
      .eq("user_id", this.userId)
      .select("*")
      .single();
    if (error) throw error;
    await this.event(data.recipe_id, "cook_abandoned");
    return sessionFromRow(data);
  }

  async replaceSubstitutions(
    sessionId: string,
    substitutions: { originalIngredient: string; replacementIngredient: string }[],
  ) {
    await this.supabase
      .from("cooking_substitutions")
      .delete()
      .eq("cooking_session_id", sessionId)
      .eq("user_id", this.userId);
    const rows = substitutions
      .map((item) => ({
        user_id: this.userId,
        cooking_session_id: sessionId,
        original_ingredient: sanitizeText(item.originalIngredient, 80),
        replacement_ingredient: sanitizeText(item.replacementIngredient, 80),
      }))
      .filter((item) => item.original_ingredient && item.replacement_ingredient)
      .slice(0, 20);
    if (!rows.length) return [];
    const { data, error } = await this.supabase
      .from("cooking_substitutions")
      .insert(rows)
      .select("*");
    if (error) throw error;
    return (data ?? []).map(substitutionFromRow);
  }

  async migrate(data: CookingHistoryData): Promise<CookingHistoryData> {
    const current = await this.list(100);
    const existingKeys = new Set(current.sessions.map(migrationKeyForSession));
    const idMap = new Map<string, string>();
    for (const session of data.sessions) {
      const key = migrationKeyForSession(session);
      if (existingKeys.has(key)) continue;
      const created = await this.start(
        session.recipeId,
        session.recipeSnapshot,
        session.servings,
        key,
      );
      idMap.set(session.id, created.id);
      if (session.status === "completed")
        await this.complete(created.id, {
          rating: session.rating,
          wouldCookAgain: session.wouldCookAgain,
          notes: session.notes,
          actualMinutes: session.actualMinutes,
          servings: session.servings,
        });
      if (session.status === "abandoned") await this.abandon(created.id);
    }
    for (const [oldId, newId] of idMap) {
      const subs = data.substitutions.filter((sub) => sub.cookingSessionId === oldId);
      if (subs.length) await this.replaceSubstitutions(newId, subs);
    }
    return this.list(100);
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
