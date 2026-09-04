import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mic, Plus, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePantry } from "@/lib/pantry-store";
import { ASSUMED_STAPLES, MEAL_PREFERENCES } from "@/lib/recipes";
import { parseIngredients, transcribeMockSpeech } from "@/lib/speech";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PantryTalk — What's in your kitchen?" },
      {
        name: "description",
        content:
          "Speak or type the ingredients you have at home and PantryTalk suggests five dishes you can realistically cook tonight.",
      },
      { property: "og:title", content: "PantryTalk — What's in your kitchen?" },
      {
        property: "og:description",
        content:
          "Speak or type the ingredients you have at home and PantryTalk suggests five dishes you can realistically cook tonight.",
      },
    ],
  }),
  component: IngredientInput,
});

function IngredientInput() {
  const { ingredients, addIngredient, removeIngredient, setIngredients, preference, setPreference } =
    usePantry();
  const [listening, setListening] = useState(false);
  const [manual, setManual] = useState("");
  const navigate = useNavigate();

  async function handleMic() {
    setListening(true);
    const transcript = await transcribeMockSpeech();
    setIngredients(parseIngredients(transcript));
    setListening(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-5 pt-24 pb-16 sm:px-8">
      <header className="text-center">
        <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">PantryTalk</p>
        <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">What&rsquo;s in your kitchen?</h1>
        <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
          Tell me what ingredients you have, and I&rsquo;ll find something worth cooking.
        </p>
      </header>

      <div className="mt-12 flex flex-col items-center">
        <button
          type="button"
          onClick={handleMic}
          disabled={listening}
          className={`flex size-32 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-90 sm:size-36 ${listening ? "mic-listening" : ""}`}
        >
          {listening ? (
            <Loader2 className="size-11 animate-spin" aria-hidden />
          ) : (
            <Mic className="size-11" aria-hidden />
          )}
        </button>
        <p className="mt-5 text-lg font-semibold">
          {listening ? "Listening…" : "Tell me what you have"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Tap the mic and say your ingredients</p>
      </div>

      <section className="mt-10 rounded-3xl border border-border bg-card p-5 shadow-card sm:p-7">
        <h2 className="text-xl">Your ingredients</h2>

        {ingredients.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing yet — use the mic, or add ingredients by hand below.
          </p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {ingredients.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => removeIngredient(item)}
                  aria-label={`Remove ${item}`}
                  className="flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-base font-medium text-accent-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {item}
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addIngredient(manual);
            setManual("");
          }}
        >
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Add another ingredient"
            aria-label="Add another ingredient"
            className="h-12 rounded-full bg-secondary px-5 text-base"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Add ingredient"
            className="size-12 shrink-0 rounded-full"
          >
            <Plus className="size-5" />
          </Button>
        </form>

        <div className="mt-6 rounded-2xl bg-secondary p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden />
            Already assumed in your kitchen
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{ASSUMED_STAPLES.join(" · ")}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl">What are you in the mood for?</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {MEAL_PREFERENCES.map((option) => {
            const active = preference === option;
            return (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => setPreference(option)}
                  aria-pressed={active}
                  className={`min-h-11 rounded-full border px-5 text-base font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-accent"
                  }`}
                >
                  {option}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Button
        size="lg"
        disabled={ingredients.length === 0}
        onClick={() => navigate({ to: "/recipes" })}
        className="mt-10 h-16 w-full rounded-full text-lg font-semibold shadow-lift"
      >
        Find recipes
      </Button>
    </main>
  );
}
