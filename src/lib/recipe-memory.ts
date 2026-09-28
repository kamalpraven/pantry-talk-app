import type {
  CookingHistoryData,
  CookingSession,
  CookingSubstitution,
} from "./cooking-history-persistence";

export type RecipeMemory = {
  recipeId: string;
  cookedCount: number;
  lastCookedAt: string | null;
  lastRating: number | null;
  usualServings: number | null;
  lastSubstitution: CookingSubstitution | null;
};

export function memoryForRecipe(data: CookingHistoryData, recipeId: string): RecipeMemory {
  const completed = data.sessions
    .filter((session) => session.recipeId === recipeId && session.status === "completed")
    .sort(
      (a, b) => Date.parse(b.completedAt ?? b.startedAt) - Date.parse(a.completedAt ?? a.startedAt),
    );
  const last = completed[0];
  const servings = completed
    .map((session) => session.servings)
    .filter((value): value is number => value != null);
  const usualServings = servings.length
    ? ([
        ...new Map(
          servings.map((value) => [
            value,
            servings.filter((candidate) => candidate === value).length,
          ]),
        ).entries(),
      ].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null)
    : null;
  const lastSubstitution = last
    ? (data.substitutions.filter((sub) => sub.cookingSessionId === last.id).at(-1) ?? null)
    : null;
  return {
    recipeId,
    cookedCount: completed.length,
    lastCookedAt: last?.completedAt ?? last?.startedAt ?? null,
    lastRating: last?.rating ?? null,
    usualServings,
    lastSubstitution,
  };
}

export function mostCooked(
  data: CookingHistoryData,
): { recipeId: string; count: number; session: CookingSession }[] {
  const completed = data.sessions.filter((session) => session.status === "completed");
  const counts = new Map<string, { count: number; session: CookingSession }>();
  for (const session of completed) {
    const current = counts.get(session.recipeId);
    counts.set(session.recipeId, {
      count: (current?.count ?? 0) + 1,
      session: current?.session ?? session,
    });
  }
  return [...counts.entries()]
    .map(([recipeId, value]) => ({ recipeId, ...value }))
    .sort((a, b) => b.count - a.count);
}

export function formatCookedCount(count: number) {
  if (count === 1) return "You've cooked this once.";
  return `You've cooked this ${count} times.`;
}
