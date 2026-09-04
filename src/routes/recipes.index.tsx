import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, CheckCircle2, AlertCircle, Repeat2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePantry } from "@/lib/pantry-store";
import { findRecipes, readinessLabel, substituteLabel } from "@/lib/recipes";

export const Route = createFileRoute("/recipes/")({
  head: () => ({
    meta: [
      { title: "Your recipe matches — PantryTalk" },
      {
        name: "description",
        content:
          "Five dishes matched to the ingredients in your kitchen, with cooking time, calories, protein, pantry match and what's missing.",
      },
      { property: "og:title", content: "Your recipe matches — PantryTalk" },
      {
        property: "og:description",
        content:
          "Five dishes matched to the ingredients in your kitchen, with cooking time, calories, protein, pantry match and what's missing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecipeResults,
});

function RecipeResults() {
  const { ingredients, filters, timeLimit, goals } = usePantry();
  const matches = findRecipes(ingredients, filters).slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-24 pb-20 sm:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Edit ingredients
      </Link>

      <h1 className="mt-5 text-3xl sm:text-4xl">Five things worth cooking</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Based on {ingredients.length ? ingredients.join(" · ") : "your pantry"} — {timeLimit.toLowerCase()}
        {goals.length ? `, ${goals.join(", ").toLowerCase()}` : ""}.
      </p>

      <ul className="mt-8 space-y-8">
        {matches.map(({ recipe, used, missing, matchPercent, substitutions, labels, reason }) => {
          const ready = missing.length === 0;
          return (
            <li
              key={recipe.id}
              className="overflow-hidden rounded-3xl border border-border bg-card shadow-card transition-shadow hover:shadow-lift"
            >
              <img
                src={recipe.image}
                alt={recipe.name}
                width={1200}
                height={900}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
              />
              <div className="p-5 sm:p-7">
                <h2 className="text-2xl sm:text-3xl">{recipe.name}</h2>

                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4 text-primary" aria-hidden />
                    {recipe.timeMinutes} min
                  </span>
                  <span aria-hidden className="text-muted-foreground">
                    ·
                  </span>
                  <span className="text-muted-foreground">~{recipe.nutrition.calories} kcal</span>
                  <span aria-hidden className="text-muted-foreground">
                    ·
                  </span>
                  <span className="text-muted-foreground">{recipe.nutrition.protein}g protein</span>
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                      ready
                        ? "bg-accent text-accent-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {ready ? (
                      <CheckCircle2 className="size-4" aria-hidden />
                    ) : (
                      <AlertCircle className="size-4" aria-hidden />
                    )}
                    {readinessLabel(missing)}
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {matchPercent}% pantry match
                  </span>
                  {substitutions.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground">
                      <Repeat2 className="size-4" aria-hidden />
                      {substituteLabel(substitutions.length)}
                    </span>
                  )}
                  {labels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-primary/30 px-3 py-1.5 text-sm font-semibold text-primary"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl bg-secondary p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="size-4 text-primary" aria-hidden />
                    Why this?
                  </p>
                  <p className="mt-1 text-base text-muted-foreground">{reason}</p>
                </div>

                <dl className="mt-5 space-y-2 text-base">
                  <div>
                    <dt className="text-sm font-semibold tracking-wide text-foreground uppercase">
                      Uses
                    </dt>
                    <dd className="text-muted-foreground">{used.join(" · ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold tracking-wide text-foreground uppercase">
                      Assumed
                    </dt>
                    <dd className="text-muted-foreground">{recipe.staples.join(" · ")}</dd>
                  </div>
                  {missing.length > 0 && (
                    <div>
                      <dt className="text-sm font-semibold tracking-wide text-foreground uppercase">
                        Missing
                      </dt>
                      <dd className="text-muted-foreground">{missing.join(" · ")}</dd>
                    </div>
                  )}
                </dl>

                <Button asChild size="lg" className="mt-6 h-14 w-full rounded-full text-base">
                  <Link to="/recipes/$recipeId" params={{ recipeId: recipe.id }}>
                    Cook this
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
