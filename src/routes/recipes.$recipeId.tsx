import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock, Users, Sparkles, Repeat2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePantry } from "@/lib/pantry-store";
import { getRecipe, matchRecipe, readinessLabel } from "@/lib/recipes";


export const Route = createFileRoute("/recipes/$recipeId")({
  loader: ({ params }) => {
    const recipe = getRecipe(params.recipeId);
    if (!recipe) throw notFound();
    return { name: recipe.name, blurb: recipe.blurb };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Recipe not found — PantryTalk" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.name} — PantryTalk`;
    return {
      meta: [
        { title },
        { name: "description", content: loaderData.blurb },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.blurb },
      ],
    };
  },
  component: RecipeDetail,
});

function RecipeDetail() {
  const { recipeId } = Route.useParams();
  const { ingredients } = usePantry();
  const recipe = getRecipe(recipeId)!;
  const { used, missing, matchPercent, substitutions } = matchRecipe(recipe, ingredients);


  return (
    <main className="pb-20">
      <div className="relative">
        <img
          src={recipe.image}
          alt={recipe.name}
          width={1200}
          height={900}
          className="h-[42vh] max-h-[420px] w-full object-cover sm:h-[52vh]"
        />
      </div>

      <div className="mx-auto -mt-10 w-full max-w-3xl px-5 sm:px-8">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-lift sm:p-9">
          <span className="inline-flex rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground">
            {readinessLabel(missing)}
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl">{recipe.name}</h1>
          <p className="mt-2 text-base text-muted-foreground">{recipe.blurb}</p>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-base">
            <span className="inline-flex items-center gap-2 font-medium">
              <Clock className="size-4 text-primary" aria-hidden />
              {recipe.timeMinutes} min
            </span>
            <span className="inline-flex items-center gap-2 font-medium">
              <Users className="size-4 text-primary" aria-hidden />
              Serves {recipe.servings}
            </span>
            <span className="inline-flex items-center gap-2 font-medium">
              <Flame className="size-4 text-primary" aria-hidden />
              ~{recipe.nutrition.calories} kcal · {recipe.nutrition.protein}g protein
            </span>
            <span className="inline-flex items-center gap-2 font-semibold text-primary">
              <Sparkles className="size-4" aria-hidden />
              {matchPercent}% pantry match
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Calories and protein are estimates per serving.
          </p>

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

          <Button asChild size="lg" className="mt-10 h-16 w-full rounded-full text-lg font-semibold">
            <Link to="/cook/$recipeId" params={{ recipeId: recipe.id }}>
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
