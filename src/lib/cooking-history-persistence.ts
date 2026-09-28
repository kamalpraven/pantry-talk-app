import type { CookingRecipeSnapshot } from "./recipe-snapshots";

export const GUEST_HISTORY_KEY = "pantrytalk.guest-history.v1";
const ACCOUNT_HISTORY_PREFIX = "pantrytalk.account-history-cache.v1:";
export const MAX_GUEST_HISTORY = 25;

export type CookingStatus = "active" | "completed" | "abandoned";
export type WouldCookAgain = "yes" | "maybe" | "no" | null;

export type CookingSubstitution = {
  id: string;
  cookingSessionId: string;
  originalIngredient: string;
  replacementIngredient: string;
  createdAt: string;
};

export type CookingSession = {
  id: string;
  recipeId: string;
  recipeSnapshot: CookingRecipeSnapshot | null;
  startedAt: string;
  completedAt: string | null;
  status: CookingStatus;
  servings: number | null;
  actualMinutes: number | null;
  rating: number | null;
  wouldCookAgain: WouldCookAgain;
  notes: string | null;
  finishedPhotoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  migrationKey?: string;
};

export type CookingHistoryData = {
  version: 1;
  sessions: CookingSession[];
  substitutions: CookingSubstitution[];
  activeSessionId: string | null;
  savedAt: string;
};

export function emptyHistoryData(): CookingHistoryData {
  return {
    version: 1,
    sessions: [],
    substitutions: [],
    activeSessionId: null,
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
export function sessionLocalId(recipeId: string) {
  return `cook-${recipeId.replace(/[^a-zA-Z0-9_-]+/g, "-")}-${Date.now().toString(36)}`;
}
export function migrationKeyForSession(
  session: Pick<CookingSession, "migrationKey" | "id" | "recipeId" | "startedAt">,
) {
  return session.migrationKey ?? `${session.recipeId}:${session.startedAt}:${session.id}`;
}

export function validateRating(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error("Rating must be 1–5.");
  return value;
}

export function validateServings(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 30)
    throw new Error("Servings must be between 1 and 30.");
  return value;
}

export function validateDuration(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 0 || value > 1440)
    throw new Error("Duration is out of range.");
  return value;
}

function cleanSession(raw: unknown): CookingSession | null {
  if (!isRecord(raw)) return null;
  const recipeId = typeof raw["recipeId"] === "string" ? raw["recipeId"].trim().slice(0, 200) : "";
  if (!recipeId) return null;
  const status = ["active", "completed", "abandoned"].includes(String(raw["status"]))
    ? (String(raw["status"]) as CookingStatus)
    : "active";
  const rating = Number(raw["rating"]);
  const servings = Number(raw["servings"]);
  const actualMinutes = Number(raw["actualMinutes"]);
  const wouldCookAgain = ["yes", "maybe", "no"].includes(String(raw["wouldCookAgain"]))
    ? (String(raw["wouldCookAgain"]) as WouldCookAgain)
    : null;
  return {
    id: typeof raw["id"] === "string" && raw["id"] ? raw["id"] : sessionLocalId(recipeId),
    recipeId,
    recipeSnapshot: isRecord(raw["recipeSnapshot"])
      ? (raw["recipeSnapshot"] as CookingRecipeSnapshot)
      : null,
    startedAt: typeof raw["startedAt"] === "string" ? raw["startedAt"] : new Date().toISOString(),
    completedAt: typeof raw["completedAt"] === "string" ? raw["completedAt"] : null,
    status,
    servings: Number.isFinite(servings) ? Math.max(1, Math.min(30, Math.round(servings))) : null,
    actualMinutes: Number.isFinite(actualMinutes)
      ? Math.max(0, Math.min(1440, Math.round(actualMinutes)))
      : null,
    rating: Number.isFinite(rating) ? Math.max(1, Math.min(5, Math.round(rating))) : null,
    wouldCookAgain,
    notes: typeof raw["notes"] === "string" ? raw["notes"].slice(0, 2000) : null,
    finishedPhotoUrl: typeof raw["finishedPhotoUrl"] === "string" ? raw["finishedPhotoUrl"] : null,
    createdAt: typeof raw["createdAt"] === "string" ? raw["createdAt"] : new Date().toISOString(),
    updatedAt: typeof raw["updatedAt"] === "string" ? raw["updatedAt"] : new Date().toISOString(),
    migrationKey: typeof raw["migrationKey"] === "string" ? raw["migrationKey"] : undefined,
  };
}

function cleanSubstitution(raw: unknown): CookingSubstitution | null {
  if (!isRecord(raw)) return null;
  const cookingSessionId =
    typeof raw["cookingSessionId"] === "string" ? raw["cookingSessionId"] : "";
  const originalIngredient =
    typeof raw["originalIngredient"] === "string"
      ? raw["originalIngredient"].trim().slice(0, 80)
      : "";
  const replacementIngredient =
    typeof raw["replacementIngredient"] === "string"
      ? raw["replacementIngredient"].trim().slice(0, 80)
      : "";
  if (!cookingSessionId || !originalIngredient || !replacementIngredient) return null;
  return {
    id:
      typeof raw["id"] === "string" && raw["id"]
        ? raw["id"]
        : `sub-${cookingSessionId}-${originalIngredient}-${replacementIngredient}`,
    cookingSessionId,
    originalIngredient,
    replacementIngredient,
    createdAt: typeof raw["createdAt"] === "string" ? raw["createdAt"] : new Date().toISOString(),
  };
}

export function cleanHistoryData(raw: unknown): CookingHistoryData {
  if (!isRecord(raw)) return emptyHistoryData();
  const sessions = Array.isArray(raw["sessions"])
    ? raw["sessions"].map(cleanSession).filter((item): item is CookingSession => item !== null)
    : [];
  const unique = [
    ...new Map(sessions.map((session) => [migrationKeyForSession(session), session])).values(),
  ]
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, MAX_GUEST_HISTORY);
  const sessionIds = new Set(unique.map((session) => session.id));
  const substitutions = Array.isArray(raw["substitutions"])
    ? raw["substitutions"]
        .map(cleanSubstitution)
        .filter(
          (item): item is CookingSubstitution =>
            item !== null && sessionIds.has(item.cookingSessionId),
        )
    : [];
  const activeSessionId =
    typeof raw["activeSessionId"] === "string" && sessionIds.has(raw["activeSessionId"])
      ? raw["activeSessionId"]
      : (unique.find((session) => session.status === "active")?.id ?? null);
  return {
    version: 1,
    sessions: unique,
    substitutions,
    activeSessionId,
    savedAt: typeof raw["savedAt"] === "string" ? raw["savedAt"] : new Date().toISOString(),
  };
}

function readKey(key: string): CookingHistoryData {
  const area = storage();
  if (!area) return emptyHistoryData();
  try {
    const raw = area.getItem(key);
    return raw ? cleanHistoryData(JSON.parse(raw)) : emptyHistoryData();
  } catch {
    return emptyHistoryData();
  }
}
function writeKey(key: string, data: CookingHistoryData) {
  const area = storage();
  if (!area) return;
  try {
    area.setItem(
      key,
      JSON.stringify({ ...cleanHistoryData(data), savedAt: new Date().toISOString() }),
    );
  } catch {
    // storage unavailable
  }
}
export function readGuestHistory() {
  return readKey(GUEST_HISTORY_KEY);
}
export function writeGuestHistory(data: CookingHistoryData) {
  writeKey(GUEST_HISTORY_KEY, data);
}
export function clearGuestHistory() {
  try {
    storage()?.removeItem(GUEST_HISTORY_KEY);
  } catch {
    // ignore unavailable storage
  }
}
export function accountHistoryCacheKey(userId: string) {
  return `${ACCOUNT_HISTORY_PREFIX}${userId}`;
}
export function readAccountHistoryCache(userId: string) {
  return readKey(accountHistoryCacheKey(userId));
}
export function writeAccountHistoryCache(userId: string, data: CookingHistoryData) {
  writeKey(accountHistoryCacheKey(userId), data);
}
