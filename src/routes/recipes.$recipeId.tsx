import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { ArrowLeft, Clock, Users, Sparkles, Repeat2, Flame, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeImage } from "@/components/RecipeImage";
import { GroceryFinder } from "@/components/GroceryFinder";
import { FavoriteButton } from "@/components/FavoriteButton";
import { RecipeMemory } from "@/components/RecipeMemory";
import { usePantry } from "@/lib/pantry-store";
import { matchRecipe, readinessLabel } from "@/lib/recipes";
import { lookupRecipe } from "@/lib/recipe-cache";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/recipes/$recipeId")({
  head: () => ({
    meta: [
      { title: "Recipe — PantryTalk" },
      {
        name: "description",
        content:
          "Ingredients, estimated macros, substitutions and step-by-step instructions for the dish you picked.",
      },
      { property: "og:title", content: "Recipe — PantryTalk" },
      {
        property: "og:description",
        content:
          "Ingredients, estimated macros, substitutions and step-by-step instructions for the dish you picked.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecipeDetail,
});

function RecipeDetail() {
  const { recipeId } = Route.useParams();
  const { ingredients } = usePantry();
  const hydrated = useHydrated();
  const recipe = hydrated ? lookupRecipe(recipeId) : undefined;

  if (!recipe) {
    if (!hydrated) return <main className="min-h-screen" />;
    return (
      <main className="mx-auto w-full max-w-3xl px-5 pt-28 pb-20 sm:px-8">
        <h1 className="text-3xl">That recipe isn&rsquo;t loaded</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Head back to your matches and pick a dish again.
        </p>
        <Button asChild className="mt-6 h-14 rounded-full px-6 text-base">
          <Link to="/recipes">Back to recipes</Link>
        </Button>
      </main>
    );
  }

  const { used, missing, matchPercent, substitutions } = matchRecipe(recipe, ingredients);
  const { calories, protein, carbs, fat } = recipe.nutrition;

  return (
    <main className="pb-20">
      <RecipeImage recipe={recipe} className="h-[42vh] max-h-[420px] w-full sm:h-[52vh]" />

      <div className="mx-auto -mt-10 w-full max-w-3xl px-5 sm:px-8">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-lift sm:p-9">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground">
              {readinessLabel(missing)}
            </span>
            <FavoriteButton recipe={recipe} compact className="h-10 rounded-full px-3" />
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl">{recipe.name}</h1>
          <p className="mt-2 text-base text-muted-foreground">{recipe.blurb}</p>
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
            >
              <ExternalLink className="size-4" aria-hidden />
              View source{recipe.sourceName ? ` · ${recipe.sourceName}` : ""}
            </a>
          )}

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-base">
            <span className="inline-flex items-center gap-2 font-medium">
              <Clock className="size-4 text-primary" aria-hidden />
              {recipe.timeMinutes} min
            </span>
            <span className="inline-flex items-center gap-2 font-medium">
              <Users className="size-4 text-primary" aria-hidden />
              Serves {recipe.servings}
            </span>
            <span className="inline-flex items-center gap-2 font-semibold text-primary">
              <Sparkles className="size-4" aria-hidden />
              {matchPercent}% pantry match
            </span>
          </div>

          <section className="mt-5 rounded-2xl bg-secondary p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Flame className="size-4 text-primary" aria-hidden />
              Estimated nutrition per serving
            </h2>
            <p className="mt-2 text-base">
              {calories} kcal · {protein}g protein
              {carbs !== undefined ? ` · ${carbs}g carbs` : ""}
              {fat !== undefined ? ` · ${fat}g fat` : ""}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Estimates only — not laboratory measurements.
            </p>
          </section>

          {recipe.dietaryTags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {recipe.dietaryTags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-primary/30 px-3 py-1.5 text-sm font-semibold text-primary"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}

          <RecipeMemory recipeId={recipe.id} />

          {substitutions.length > 0 && (
            <section className="mt-6 rounded-2xl bg-secondary p-4">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Repeat2 className="size-4 text-primary" aria-hidden />
                Easy substitutes
              </h2>
              <ul className="mt-3 space-y-2 text-base">
                {substitutions.map((sub) => (
                  <li key={sub.missing}>
                    <span className="font-semibold">{sub.missing}</span>
                    <span className="text-muted-foreground"> → {sub.suggestion}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                Suggestions only — the result will taste a little different.
              </p>
            </section>
          )}

          {missing.length > 0 && <GroceryFinder missing={missing} />}

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <section>
              <h2 className="text-lg">You already have</h2>
              <ul className="mt-3 space-y-1.5 text-base text-muted-foreground">
                {used.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-lg">Assumed staples</h2>
              <ul className="mt-3 space-y-1.5 text-base text-muted-foreground">
                {recipe.staples.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            {missing.length > 0 && (
              <section>
                <h2 className="text-lg">You&rsquo;ll need</h2>
                <ul className="mt-3 space-y-1.5 text-base text-muted-foreground">
                  {missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            {recipe.ingredientLines && recipe.ingredientLines.length > 0 && (
              <section className="sm:col-span-2">
                <h2 className="text-lg">Full ingredient list</h2>
                <ul className="mt-3 space-y-1.5 text-base text-muted-foreground">
                  {recipe.ingredientLines.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <section className="mt-10">
            <h2 className="text-2xl">How to cook it</h2>
            <ol className="mt-4 space-y-4">
              {recipe.steps.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-semibold">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-base leading-relaxed sm:text-lg">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          <Button
            asChild
            size="lg"
            className="mt-10 h-16 w-full rounded-full text-lg font-semibold"
          >
            <Link
              to="/cook/$recipeId"
              params={{ recipeId: recipe.id }}
              onClick={() => trackEvent("cook_mode_started", { recipeId: recipe.id })}
            >
              Start cooking
            </Link>
          </Button>
          <Button asChild variant="ghost" className="mt-3 w-full rounded-full">
            <Link to="/recipes">
              <ArrowLeft className="size-4" aria-hidden />
              Back to recipes
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
