import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Repeat2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookingHistory } from "@/lib/cooking-history-store";
import { lookupRecipeWithSnapshot } from "@/lib/recipe-snapshots";

export const Route = createFileRoute("/history/$sessionId")({ component: HistoryDetail });

function HistoryDetail() {
  const { sessionId } = Route.useParams();
  const history = useCookingHistory();
  const session = history.sessionById(sessionId);
  if (!session) {
    return (
      <main className="mx-auto max-w-3xl px-5 pt-28">
        <h1 className="text-3xl">Cooking session not found</h1>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/history">Back to history</Link>
        </Button>
      </main>
    );
  }
  const recipe = lookupRecipeWithSnapshot(session.recipeId, session.recipeSnapshot);
  const substitutions = history.substitutionsFor(session.id);
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-24 pb-20 sm:px-8">
      <Link
        to="/history"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Back to history
      </Link>
      <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        {(recipe?.imageUrl || recipe?.image) && (
          <img src={recipe.imageUrl ?? recipe.image} alt="" className="h-64 w-full object-cover" />
        )}
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
            Cooked meal
          </p>
          <h1 className="mt-3 text-4xl">
            {recipe?.name ?? session.recipeSnapshot?.name ?? session.recipeId}
          </h1>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold uppercase">Cooked date</dt>
              <dd className="text-muted-foreground">
                {new Date(session.completedAt ?? session.startedAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold uppercase">Duration</dt>
              <dd className="text-muted-foreground">
                {session.actualMinutes != null ? `${session.actualMinutes} min` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold uppercase">Servings</dt>
              <dd className="text-muted-foreground">{session.servings ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold uppercase">Would cook again</dt>
              <dd className="text-muted-foreground">{session.wouldCookAgain ?? "—"}</dd>
            </div>
          </dl>
          {session.rating && (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 font-semibold">
              <Star className="size-4 text-primary" /> {session.rating}/5
            </p>
          )}
          {session.notes && (
            <div className="mt-6 rounded-2xl bg-secondary p-4">
              <h2 className="font-semibold">Notes</h2>
              <p className="mt-1 text-muted-foreground">{session.notes}</p>
            </div>
          )}
          {substitutions.length > 0 && (
            <div className="mt-6 rounded-2xl bg-secondary p-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <Repeat2 className="size-4 text-primary" /> Substitutions
              </h2>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {substitutions.map((sub) => (
                  <li key={sub.id}>
                    {sub.originalIngredient} → {sub.replacementIngredient}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button asChild className="mt-8 h-14 w-full rounded-full text-base">
            <Link
              to="/cook/$recipeId"
              params={{ recipeId: session.recipeId }}
              search={{ again: session.id }}
            >
              Cook this again
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
