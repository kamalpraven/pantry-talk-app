import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookHeart, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFavorites } from "@/lib/favorites-store";
import { lookupRecipe } from "@/lib/recipe-cache";

export const Route = createFileRoute("/saved")({ component: SavedPage });

function SavedPage() {
  const favorites = useFavorites();
  const [query, setQuery] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const shown = useMemo(
    () =>
      favorites.favorites.filter((favorite) => {
        const name = favorite.recipeSnapshot?.name ?? favorite.recipeId;
        return name.toLowerCase().includes(query.toLowerCase());
      }),
    [favorites.favorites, query],
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pt-24 pb-20 sm:px-8">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">
        Saved recipes
      </p>
      <h1 className="mt-3 text-4xl">Things worth cooking again</h1>
      <p className="mt-3 text-muted-foreground">
        Your favorite PantryTalk ideas, with collections for the moods you come back to.
      </p>

      <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-primary" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search saved recipes"
            className="rounded-full"
          />
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="text-2xl">Collections</h2>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (collectionName.trim())
              void favorites.createCollection(collectionName).then(() => setCollectionName(""));
          }}
        >
          <Input
            value={collectionName}
            onChange={(event) => setCollectionName(event.target.value)}
            placeholder="Weeknight, High Protein…"
            className="rounded-full"
          />
          <Button type="submit" className="rounded-full">
            <Plus className="size-4" aria-hidden /> Create
          </Button>
        </form>
        <ul className="mt-4 flex flex-wrap gap-2">
          {favorites.collections.map((collection) => (
            <li
              key={collection.id}
              className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-sm font-semibold"
            >
              {collection.name}
              <button
                type="button"
                onClick={() => void favorites.deleteCollection(collection.id)}
                aria-label={`Delete ${collection.name}`}
              >
                <Trash2 className="size-3 text-primary" />
              </button>
            </li>
          ))}
          {!favorites.collections.length && (
            <li className="text-sm text-muted-foreground">
              Create your first collection when a pattern emerges.
            </li>
          )}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl">Recently saved</h2>
        {!shown.length ? (
          <div className="mt-4 rounded-3xl border border-dashed border-primary/30 bg-card p-8 text-center shadow-card">
            <BookHeart className="mx-auto size-10 text-primary" aria-hidden />
            <p className="mt-4 text-xl font-semibold">No saved recipes yet.</p>
            <p className="mt-2 text-muted-foreground">Save something you want to cook again.</p>
            <Button asChild className="mt-5 rounded-full">
              <Link to="/recipes">Find recipes</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {shown.map((favorite) => {
              const recipe = lookupRecipe(favorite.recipeId);
              const snapshot = favorite.recipeSnapshot;
              const name = recipe?.name ?? snapshot?.name ?? favorite.recipeId;
              const image =
                recipe?.imageUrl ?? recipe?.image ?? snapshot?.imageUrl ?? snapshot?.image;
              return (
                <li
                  key={favorite.id}
                  className="overflow-hidden rounded-3xl border border-border bg-card shadow-card"
                >
                  {image && <img src={image} alt="" className="h-40 w-full object-cover" />}
                  <div className="p-4">
                    <h3 className="text-xl">{name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Saved {new Date(favorite.createdAt).toLocaleDateString()}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild className="rounded-full">
                        <Link to="/recipes/$recipeId" params={{ recipeId: favorite.recipeId }}>
                          Open recipe
                        </Link>
                      </Button>
                      <Button asChild variant="secondary" className="rounded-full">
                        <Link to="/cook/$recipeId" params={{ recipeId: favorite.recipeId }}>
                          Start cooking
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void favorites.removeRecipe(favorite.recipeId)}
                        className="rounded-full"
                      >
                        Remove
                      </Button>
                    </div>
                    {favorites.collections.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {favorites.collections.map((collection) => {
                          const inCollection = favorites.memberships.some(
                            (membership) =>
                              membership.collectionId === collection.id &&
                              membership.favoriteRecipeId === favorite.id,
                          );
                          return (
                            <button
                              key={collection.id}
                              type="button"
                              onClick={() =>
                                inCollection
                                  ? void favorites.removeFromCollection(
                                      collection.id,
                                      favorite.recipeId,
                                    )
                                  : void favorites.addToCollection(collection.id, favorite.recipeId)
                              }
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${inCollection ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary"}`}
                            >
                              {collection.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
