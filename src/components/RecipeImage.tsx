import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { Recipe } from "@/lib/recipes";

/**
 * Shows the recipe's own photo (bundled or from live discovery) and falls back
 * to a clean placeholder instead of a broken image.
 */
export function RecipeImage({
  recipe,
  className,
}: {
  recipe: Recipe;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = recipe.image || recipe.imageUrl || "";

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-secondary to-accent ${className ?? ""}`}
        aria-hidden
      >
        <UtensilsCrossed className="size-10 text-primary/50" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={recipe.name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? ""}`}
    />
  );
}
