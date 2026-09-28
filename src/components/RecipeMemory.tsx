import { Clock3, Repeat2, Star, Users } from "lucide-react";
import { format } from "date-fns";
import { useCookingHistory } from "@/lib/cooking-history-store";
import { formatCookedCount } from "@/lib/recipe-memory";

export function RecipeMemory({ recipeId }: { recipeId: string }) {
  const history = useCookingHistory();
  const memory = history.memoryFor(recipeId);
  if (memory.cookedCount === 0) return null;
  return (
    <section className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <h2 className="text-base font-semibold">PantryTalk remembers</h2>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Repeat2 className="size-4 text-primary" aria-hidden />
          {formatCookedCount(memory.cookedCount)}
        </li>
        {memory.lastCookedAt && (
          <li className="flex items-center gap-2">
            <Clock3 className="size-4 text-primary" aria-hidden />
            Last cooked {format(new Date(memory.lastCookedAt), "MMMM d")}
          </li>
        )}
        {memory.lastRating && (
          <li className="flex items-center gap-2">
            <Star className="size-4 text-primary" aria-hidden />
            You rated this {memory.lastRating}/5 last time.
          </li>
        )}
        {memory.lastSubstitution && (
          <li className="flex items-center gap-2">
            <Repeat2 className="size-4 text-primary" aria-hidden />
            Last time you used {memory.lastSubstitution.replacementIngredient} instead of{" "}
            {memory.lastSubstitution.originalIngredient}.
          </li>
        )}
        {memory.usualServings && (
          <li className="flex items-center gap-2">
            <Users className="size-4 text-primary" aria-hidden />
            You usually make {memory.usualServings} serving{memory.usualServings === 1 ? "" : "s"}.
          </li>
        )}
      </ul>
    </section>
  );
}
