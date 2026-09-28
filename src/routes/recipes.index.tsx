import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Repeat2,
  Sparkles,
  Loader2,
  ExternalLink,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeImage } from "@/components/RecipeImage";
import { usePantry } from "@/lib/pantry-store";
import { findRecipes, normalize, readinessLabel, substituteLabel, RECIPES } from "@/lib/recipes";
import { discoverRecipes } from "@/lib/linkup.functions";
import { cacheRecipes } from "@/lib/recipe-cache";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/recipes/")({
  head: () => ({
    meta: [
      { title: "Your recipe matches — PantryTalk" },
      {
        name: "description",
        content:
          "Three dishes matched to the ingredients in your kitchen, with cooking time, calories, protein, pantry match and what's missing.",
      },
      { property: "og:title", content: "Your recipe matches — PantryTalk" },
      {
        property: "og:description",
        content:
          "Three dishes matched to the ingredients in your kitchen, with cooking time, calories, protein, pantry match and what's missing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecipeResults,
});

function RecipeResults() {
  const { ingredients, pantryItems, filters, timeLimit, goals, preference } = usePantry();
  const search = useServerFn(discoverRecipes);

  const { data, isFetching } = useQuery({
    queryKey: ["recipes", ingredients, preference, timeLimit, goals],
    queryFn: () => search({ data: { ingredients, preference, timeLimit, goals } }),
    enabled: ingredients.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const live = data?.recipes ?? [];
  const usingFallback = live.length === 0;
  // Show good matches from the built-in dishes straight away, then swap in
  // the live web results the moment they arrive.
  const pool = usingFallback ? RECIPES : live;
  const matches = findRecipes(ingredients, filters, pool).slice(0, 3);

  useEffect(() => {
    if (pool.length) cacheRecipes(pool);
  }, [pool]);

  useEffect(() => {
    if (!isFetching && matches.length > 0) {
      trackEvent("meal_plan_generated", {
        resultCount: matches.length,
        liveSearch: !usingFallback,
      });
    }
  }, [isFetching, matches.length, usingFallback]);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-24 pb-20 sm:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Edit ingredients
      </Link>

      <h1 className="mt-5 text-3xl sm:text-4xl">Three dinners worth cooking</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Based on {ingredients.length ? ingredients.join(" · ") : "your pantry"} — {timeLimit.toLowerCase()}
        {goals.length ? `, ${goals.join(", ").toLowerCase()}` : ""}.
      </p>

      {isFetching && (
        <p
          className="mt-6 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-secondary to-accent p-4 text-base font-medium text-primary"
          role="status"
        >
          <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
          Here are quick ideas now — still looking online for even better matches…
        </p>
      )}

      {!isFetching && usingFallback && ingredients.length > 0 && (
        <p className="mt-6 rounded-2xl bg-secondary p-4 text-base text-muted-foreground" role="status">
          Live recipe search is unavailable, so here are some suggestions based on your ingredients.
        </p>
      )}

      {!isFetching && !usingFallback && (
        <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-primary">
          <Globe className="size-4" aria-hidden />
          Found live on the web just now
        </p>
      )}

      <ul className="mt-8 space-y-8">
        {matches.map(({ recipe, used, missing, matchPercent, substitutions, labels, reason }) => {
          const ready = missing.length === 0;
          const useSoon = pantryItems.filter(
            (item) =>
              item.useSoonDays != null &&
              item.useSoonDays <= 3 &&
              used.some((ingredient) => normalize(ingredient) === normalize(item.name)),
          );
          return (
            <li
              key={recipe.id}
              className="group overflow-hidden rounded-3xl border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <RecipeImage
                recipe={recipe}
                className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-[1.03] sm:aspect-[16/9]"
              />
              <div className="p-5 sm:p-7">
                <h2 className="text-2xl sm:text-3xl">{recipe.name}</h2>
                {recipe.sourceName && (
                  <p className="mt-1 text-sm text-muted-foreground">from {recipe.sourceName}</p>
                )}

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
                  {useSoon.length > 0 && (
                    <span className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
                      Uses {useSoon[0]?.name} soon
                    </span>
                  )}
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
                  <Link
                    to="/recipes/$recipeId"
                    params={{ recipeId: recipe.id }}
                    onClick={() => trackEvent("meal_selected", { recipeId: recipe.id, matchPercent })}
                  >
                    Cook this
                  </Link>
                </Button>
                {recipe.sourceUrl && (
                  <a
                    href={recipe.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-primary"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    View source
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {!isFetching && matches.length === 0 && (
        <p className="mt-8 text-base text-muted-foreground">
          Add a few ingredients and I&rsquo;ll find something to cook.
        </p>
      )}
    </main>
  );
}
