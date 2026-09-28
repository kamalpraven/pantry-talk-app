import { Heart, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Recipe } from "@/lib/recipes";
import { useFavorites } from "@/lib/favorites-store";
import { Button } from "@/components/ui/button";

export function FavoriteButton({
  recipe,
  className,
  compact = false,
}: {
  recipe: Recipe;
  className?: string;
  compact?: boolean;
}) {
  const favorites = useFavorites();
  const saved = favorites.isSaved(recipe.id);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      if (saved) await favorites.removeRecipe(recipe.id);
      else await favorites.saveRecipe(recipe);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={saved ? "secondary" : "outline"}
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved recipes" : "Save recipe"}
      className={className ?? "rounded-full"}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Heart className={`size-4 ${saved ? "fill-current" : ""}`} aria-hidden />
      )}
      {!compact && <span>{saved ? "Saved" : "Save recipe"}</span>}
    </Button>
  );
}
