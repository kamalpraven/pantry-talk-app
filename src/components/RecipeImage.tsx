import { useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import type { Recipe } from "@/lib/recipes";
import avocadoEggToast from "@/assets/avocado-egg-toast.jpg";
import cheesyTomatoOmelette from "@/assets/cheesy-tomato-omelette.jpg";
import eggSaladSandwich from "@/assets/egg-salad-sandwich.jpg";
import shakshukaEggs from "@/assets/shakshuka-eggs.jpg";
import tomatoCheddarToast from "@/assets/tomato-cheddar-toast.jpg";

const FALLBACKS = [
  avocadoEggToast,
  cheesyTomatoOmelette,
  eggSaladSandwich,
  shakshukaEggs,
  tomatoCheddarToast,
];

/** Same dish always gets the same stand-in photo. */
function fallbackFor(recipe: Recipe): string {
  const key = `${recipe.name}${recipe.id}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  return FALLBACKS[hash % FALLBACKS.length] ?? avocadoEggToast;
}

function displaySrc(raw: string): string {
  // Remote photos go through the app so sites that block hotlinking still work.
  return /^https:\/\//.test(raw)
    ? `/api/public/recipe-image?url=${encodeURIComponent(raw)}`
    : raw;
}

/**
 * Shows the recipe's own photo (bundled or from live discovery) and falls back
 * to a bundled food photo instead of a blank card.
 */
export function RecipeImage({ recipe, className }: { recipe: Recipe; className?: string }) {
  const [failed, setFailed] = useState(false);
  const raw = recipe.image || recipe.imageUrl || "";
  const src = raw && !failed ? displaySrc(raw) : fallbackFor(recipe);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  if (fallbackFailed) {
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
      onError={() => (failed || !raw ? setFallbackFailed(true) : setFailed(true))}
      className={`object-cover ${className ?? ""}`}
    />
  );
}
