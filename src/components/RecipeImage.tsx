import { useEffect, useState } from "react";
import { ChefHat } from "lucide-react";
import type { Recipe } from "@/lib/recipes";

function displaySrc(raw: string): string {
  // Remote photos go through the app so sites that block hotlinking still work.
  return /^https:\/\//.test(raw)
    ? `/api/public/recipe-image?url=${encodeURIComponent(raw)}`
    : raw;
}

function RecipePlaceholder({ recipe, className }: { recipe: Recipe; className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-secondary via-background to-accent ${className ?? ""}`}
      role="img"
      aria-label={`${recipe.name} photo unavailable`}
    >
      <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_25%_25%,hsl(var(--primary)/0.20),transparent_35%),radial-gradient(circle_at_75%_70%,hsl(var(--accent-foreground)/0.12),transparent_40%)]" />
      <div className="relative flex max-w-[80%] flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-background/80 shadow-sm">
          <ChefHat className="size-7 text-primary" aria-hidden />
        </span>
        <span className="text-sm font-semibold text-muted-foreground">Recipe photo unavailable</span>
      </div>
    </div>
  );
}

/**
 * Shows the recipe's own photo. For live web recipes, a missing/broken image
 * intentionally falls back to a neutral placeholder instead of an unrelated
 * dish photo, which would be misleading.
 */
export function RecipeImage({ recipe, className }: { recipe: Recipe; className?: string }) {
  const raw = recipe.image || recipe.imageUrl || "";
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [raw, recipe.id]);

  if (!raw || failed) {
    return <RecipePlaceholder recipe={recipe} className={className} />;
  }

  return (
    <img
      src={displaySrc(raw)}
      alt={recipe.name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? ""}`}
    />
  );
}
