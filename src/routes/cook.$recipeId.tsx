import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRecipe } from "@/lib/recipes";
import { speakStep } from "@/lib/speech";

export const Route = createFileRoute("/cook/$recipeId")({
  loader: ({ params }) => {
    const recipe = getRecipe(params.recipeId);
    if (!recipe) throw notFound();
    return { name: recipe.name };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Recipe not found — PantryTalk" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Cooking ${loaderData.name} — PantryTalk`;
    const description = `Step-by-step, hands-free cooking mode for ${loaderData.name}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: CookingMode,
});

function CookingMode() {
  const { recipeId } = Route.useParams();
  const recipe = getRecipe(recipeId)!;
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();

  const total = recipe.steps.length;
  const step = recipe.steps[index] ?? "";
  const progress = ((index + 1) / total) * 100;
  const last = index === total - 1;

  return (
    <main className="flex min-h-screen flex-col px-5 pt-24 pb-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <Link
          to="/recipes/$recipeId"
          params={{ recipeId }}
          className="inline-flex items-center gap-2 self-start text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Leave cooking mode
        </Link>

        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <p className="text-lg font-semibold">{recipe.name}</p>
            <p className="text-base font-medium text-muted-foreground">
              Step {index + 1} of {total}
            </p>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <p className="max-w-2xl text-center text-3xl leading-snug font-medium sm:text-4xl md:text-5xl md:leading-tight">
            {step}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="secondary"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="h-20 rounded-3xl text-base font-semibold sm:text-lg"
          >
            <ChevronLeft className="size-6" aria-hidden />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => speakStep(step)}
            className="h-20 rounded-3xl text-base font-semibold sm:text-lg"
          >
            <RotateCcw className="size-6" aria-hidden />
            Repeat
          </Button>
          {last ? (
            <Button
              onClick={() => navigate({ to: "/recipes" })}
              className="h-20 rounded-3xl text-base font-semibold sm:text-lg"
            >
              <Check className="size-6" aria-hidden />
              Done
            </Button>
          ) : (
            <Button
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
              className="h-20 rounded-3xl text-base font-semibold sm:text-lg"
            >
              Next
              <ChevronRight className="size-6" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
