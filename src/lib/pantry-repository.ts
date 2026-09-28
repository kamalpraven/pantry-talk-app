import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { pantryItemId, type PantryItem, type PantrySource, type PantryUnit } from "./inventory";
import { normalizedPantryName } from "./pantry-merge";

const MAX_PANTRY_ITEMS = 200;
const MAX_NAME_LENGTH = 80;
const VALID_UNITS = new Set<PantryUnit>(["count", "g", "ml", "portion"]);
const VALID_SOURCES = new Set<PantrySource>([
  "manual",
  "voice",
  "demo",
  "scan",
  "cook",
  "correction",
]);

type PantryRow = Database["public"]["Tables"]["pantry_items"]["Row"];
type PantryInsert = Database["public"]["Tables"]["pantry_items"]["Insert"];

export function sanitizePantryItem(item: PantryItem): PantryItem | null {
  const name = item.name.trim().slice(0, MAX_NAME_LENGTH);
  if (!name) return null;
  const quantity = Number(item.quantityEstimate);
  const confidence = Number(item.confidence);
  const useSoon = item.useSoonDays == null ? null : Number(item.useSoonDays);
  return {
    id: item.id || pantryItemId(name),
    name,
    quantityEstimate: Number.isFinite(quantity) ? Math.max(0, Math.min(quantity, 100000)) : 1,
    unit: VALID_UNITS.has(item.unit) ? item.unit : "portion",
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(confidence, 1)) : 0.7,
    source: VALID_SOURCES.has(item.source) ? item.source : "manual",
    ...(useSoon != null && Number.isFinite(useSoon)
      ? { useSoonDays: Math.max(0, Math.min(365, Math.round(useSoon))) }
      : {}),
    ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}),
  };
}

export function rowToPantryItem(row: PantryRow): PantryItem {
  return {
    id: row.id,
    name: row.display_name,
    quantityEstimate: row.quantity ?? 1,
    unit: (row.unit ?? "portion") as PantryUnit,
    confidence: row.confidence ?? 0.7,
    source: (row.source ?? "manual") as PantrySource,
    ...(row.use_soon_days != null ? { useSoonDays: row.use_soon_days } : {}),
    updatedAt: row.updated_at,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function pantryItemToInsert(item: PantryItem, userId: string): PantryInsert | null {
  const clean = sanitizePantryItem(item);
  if (!clean) return null;
  return {
    ...(isUuid(clean.id) ? { id: clean.id } : {}),
    user_id: userId,
    normalized_name: normalizedPantryName(clean.name),
    display_name: clean.name,
    quantity: clean.quantityEstimate,
    unit: clean.unit,
    confidence: clean.confidence,
    source: clean.source,
    use_soon_days: clean.useSoonDays ?? null,
    estimated_expiry: null,
  };
}

export class SupabasePantryRepository {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly userId: string,
  ) {}

  async list(): Promise<PantryItem[]> {
    const { data, error } = await this.supabase
      .from("pantry_items")
      .select("*")
      .eq("user_id", this.userId)
      .order("display_name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToPantryItem);
  }

  async replaceAll(items: PantryItem[]): Promise<PantryItem[]> {
    const limited = items.slice(0, MAX_PANTRY_ITEMS);
    const rows = limited
      .map((item) => pantryItemToInsert(item, this.userId))
      .filter((row): row is PantryInsert => row !== null);

    const { error: deleteError } = await this.supabase
      .from("pantry_items")
      .delete()
      .eq("user_id", this.userId);
    if (deleteError) throw deleteError;

    if (!rows.length) return [];
    const { data, error } = await this.supabase
      .from("pantry_items")
      .upsert(rows, { onConflict: "user_id,normalized_name" })
      .select("*");
    if (error) throw error;
    return (data ?? []).map(rowToPantryItem);
  }
}
