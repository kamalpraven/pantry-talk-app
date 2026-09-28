import { normalize } from "./recipes";
import type { PantryItem, PantryUnit } from "./inventory";

export function normalizedPantryName(name: string) {
  return normalize(name)
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function richness(item: PantryItem) {
  return [
    item.useSoonDays != null ? 4 : 0,
    item.quantityEstimate > 0 ? 2 : 0,
    item.unit !== "portion" ? 2 : 0,
    item.confidence,
    item.source === "scan" ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function newer(a?: string, b?: string) {
  const aTime = a ? Date.parse(a) : 0;
  const bTime = b ? Date.parse(b) : 0;
  return aTime >= bTime;
}

function chooseBase(a: PantryItem, b: PantryItem) {
  const scoreA = richness(a);
  const scoreB = richness(b);
  if (scoreA !== scoreB) return scoreA > scoreB ? a : b;
  if (a.confidence !== b.confidence) return a.confidence > b.confidence ? a : b;
  return newer(a.updatedAt, b.updatedAt) ? a : b;
}

function mergeQuantity(a: PantryItem, b: PantryItem, unit: PantryUnit) {
  // Idempotent merge: duplicates with the same normalized name are treated as
  // alternate observations of the same pantry item, not separate additions.
  // We therefore never blindly sum quantities. For compatible units we keep the
  // higher-confidence/newer quantity; for conflicting units the chosen base wins.
  if (a.unit !== b.unit || a.unit !== unit) return chooseBase(a, b).quantityEstimate;
  if (a.confidence !== b.confidence)
    return a.confidence > b.confidence ? a.quantityEstimate : b.quantityEstimate;
  return newer(a.updatedAt, b.updatedAt) ? a.quantityEstimate : b.quantityEstimate;
}

export function mergePantryItems(items: PantryItem[]): PantryItem[] {
  const byName = new Map<string, PantryItem>();

  for (const item of items) {
    const key = normalizedPantryName(item.name);
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...item, updatedAt: item.updatedAt ?? new Date().toISOString() });
      continue;
    }

    const base = chooseBase(existing, item);
    const other = base === existing ? item : existing;
    const useSoonDays =
      existing.useSoonDays == null
        ? item.useSoonDays
        : item.useSoonDays == null
          ? existing.useSoonDays
          : Math.min(existing.useSoonDays, item.useSoonDays);

    byName.set(key, {
      ...base,
      id: base.id || existing.id || item.id,
      name: base.name || other.name,
      quantityEstimate: mergeQuantity(existing, item, base.unit),
      confidence: Math.max(existing.confidence, item.confidence),
      source: base.source,
      ...(useSoonDays != null ? { useSoonDays } : {}),
      updatedAt: newer(existing.updatedAt, item.updatedAt) ? existing.updatedAt : item.updatedAt,
    });
  }

  return [...byName.values()].sort((a, b) =>
    normalizedPantryName(a.name).localeCompare(normalizedPantryName(b.name)),
  );
}

export function mergeGuestIntoAccount(accountItems: PantryItem[], guestItems: PantryItem[]) {
  return mergePantryItems([...accountItems, ...guestItems]);
}

export function hasKitchenItems(items: PantryItem[]) {
  return items.some((item) => item.name.trim() && item.quantityEstimate > 0);
}
