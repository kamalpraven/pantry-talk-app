import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock3, Repeat2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookingHistory } from "@/lib/cooking-history-store";
import { lookupRecipeWithSnapshot } from "@/lib/recipe-snapshots";
import { mostCooked } from "@/lib/recipe-memory";

export const Route = createFileRoute("/history")({ component: HistoryPage });

function HistoryPage() {
  const history = useCookingHistory();
  const completed = history.sessions.filter((session) => session.status === "completed");
  const highlyRated = completed.filter((session) => (session.rating ?? 0) >= 4).slice(0, 4);
  const top = mostCooked({
    version: 1,
    sessions: history.sessions,
    substitutions: history.substitutions,
    activeSessionId: null,
    savedAt: new Date().toISOString(),
  }).slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pt-24 pb-20 sm:px-8">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
        Cooking history
      </p>
      <h1 className="mt-3 text-4xl">Meals PantryTalk remembers</h1>
      <p className="mt-3 text-muted-foreground">
        Cook again from the dinners that worked, and keep track of what changed.
      </p>

      {!completed.length ? (
        <section className="mt-8 rounded-3xl border border-dashed border-primary/30 bg-card p-8 text-center shadow-card">
          <Clock3 className="mx-auto size-10 text-primary" aria-hidden />
          <p className="mt-4 text-xl font-semibold">No cooked meals yet.</p>
          <p className="mt-2 text-muted-foreground">
            Finish a cooking session and it will appear here.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/recipes">Find something to cook</Link>
          </Button>
        </section>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-2xl">Recent cooks</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {completed.slice(0, 12).map((session) => {
                const recipe = lookupRecipeWithSnapshot(session.recipeId, session.recipeSnapshot);
                const substitutions = history.substitutionsFor(session.id);
                return (
                  <li
                    key={session.id}
                    className="overflow-hidden rounded-3xl border border-border bg-card shadow-card"
                  >
                    {(recipe?.imageUrl || recipe?.image) && (
                      <img
                        src={recipe.imageUrl ?? recipe.image}
                        alt=""
                        className="h-40 w-full object-cover"
                      />
                    )}
                    <div className="p-4">
                      <h3 className="text-xl">
                        {recipe?.name ?? session.recipeSnapshot?.name ?? session.recipeId}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Cooked{" "}
                        {new Date(session.completedAt ?? session.startedAt).toLocaleDateString()}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                        {session.rating && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="size-3 text-primary" /> {session.rating}/5
                          </span>
                        )}
                        {session.actualMinutes != null && <span>{session.actualMinutes} min</span>}
                        {substitutions.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Repeat2 className="size-3 text-primary" /> substitution
                          </span>
                        )}
                        {session.wouldCookAgain && (
                          <span>cook again: {session.wouldCookAgain}</span>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button asChild className="rounded-full">
                          <Link to="/history/$sessionId" params={{ sessionId: session.id }}>
                            View details
                          </Link>
                        </Button>
                        <Button asChild variant="secondary" className="rounded-full">
                          <Link
                            to="/cook/$recipeId"
                            params={{ recipeId: session.recipeId }}
                            search={{ again: session.id }}
                          >
                            Cook again
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" className="rounded-full">
                          <Link to="/recipes/$recipeId" params={{ recipeId: session.recipeId }}>
                            Open recipe
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-xl">Cook again</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {top.map((item) => (
                  <li key={item.recipeId}>
                    {item.session.recipeSnapshot?.name ?? item.recipeId} · made {item.count} time
                    {item.count === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-xl">Highly rated</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {highlyRated.map((session) => (
                  <li key={session.id}>
                    {session.recipeSnapshot?.name ?? session.recipeId} · {session.rating}/5
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
