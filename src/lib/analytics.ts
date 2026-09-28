export type PantryEventName =
  | "pantry_demo_loaded"
  | "pantry_scan_started"
  | "pantry_scan_completed"
  | "meal_plan_requested"
  | "meal_plan_generated"
  | "meal_selected"
  | "cook_mode_started"
  | "meal_completed"
  | "inventory_update_confirmed"
  | "music_started"
  | "recipe_saved"
  | "recipe_unsaved"
  | "cook_started"
  | "cook_completed"
  | "recipe_rated"
  | "cook_again_started"
  | "collection_created";

type PantryEvent = {
  name: PantryEventName;
  at: string;
  metadata?: Record<string, string | number | boolean | null>;
};

const STORAGE_KEY = "pantrytalk:analytics";
const MAX_EVENTS = 500;

export function trackEvent(
  name: PantryEventName,
  metadata?: Record<string, string | number | boolean | null>,
) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as PantryEvent[]) : [];
    const next: PantryEvent[] = [
      ...existing,
      { name, at: new Date().toISOString(), ...(metadata ? { metadata } : {}) },
    ].slice(-MAX_EVENTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Analytics must never interrupt the cooking experience.
  }
}

export function readEvents(): PantryEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PantryEvent[]) : [];
  } catch {
    return [];
  }
}
