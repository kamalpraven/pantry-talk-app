import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mic, Plus, X, Loader2, Sparkles, Square, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePantry } from "@/lib/pantry-store";
import { ASSUMED_STAPLES, DIET_GOALS, MEAL_PREFERENCES, TIME_LIMITS } from "@/lib/recipes";
import { parseIngredients, startRecording, transcribeAudio, type Recorder } from "@/lib/speech";
import { interpretPreferences, parsePreferencesLocally } from "@/lib/preferences.functions";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IngredientInput,
});

type Phase = "idle" | "recording" | "working";

function IngredientInput() {
  const {
    ingredients,
    addIngredient,
    removeIngredient,
    setIngredients,
    preference,
    setPreference,
    timeLimit,
    setTimeLimit,
    goals,
    toggleGoal,
    setGoals,
  } = usePantry();

  const [manual, setManual] = useState("");
  const [ingredientPhase, setIngredientPhase] = useState<Phase>("idle");
  const [moodPhase, setMoodPhase] = useState<Phase>("idle");
  const [recorder, setRecorder] = useState<Recorder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heardMood, setHeardMood] = useState<string | null>(null);
  const navigate = useNavigate();

  const busy = ingredientPhase !== "idle" || moodPhase !== "idle";

  async function record(
    setPhase: (phase: Phase) => void,
    phase: Phase,
    onTranscript: (text: string) => Promise<void> | void,
  ) {
    setError(null);
    if (phase === "recording" && recorder) {
      setPhase("working");
      try {
        const blob = await recorder.stop();
        setRecorder(null);
        const text = await transcribeAudio(blob);
        await onTranscript(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong with the microphone.");
      } finally {
        setPhase("idle");
      }
      return;
    }

    try {
      const next = await startRecording();
      setRecorder(next);
      setPhase("recording");
    } catch {
      setError("I can't reach your microphone — you can still type ingredients below.");
      setPhase("idle");
    }
  }

  const handleIngredientMic = () =>
    record(setIngredientPhase, ingredientPhase, (text) => {
      const parsed = parseIngredients(text);
      if (parsed.length === 0) {
        setError("I didn't catch any ingredients — try again or type them below.");
        return;
      }
      setIngredients(parsed);
    });

  const handleMoodMic = () =>
    record(setMoodPhase, moodPhase, async (text) => {
      setHeardMood(text);
      let parsed = parsePreferencesLocally(text);
      try {
        parsed = await interpretPreferences({ data: { text } });
      } catch {
        // keyword fallback already applied
      }
      setTimeLimit(parsed.timeLimit);
      setGoals(parsed.goals);
      setPreference(parsed.preference);
    });

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
          onClick={handleIngredientMic}
          disabled={ingredientPhase === "working" || moodPhase !== "idle"}
          aria-label="Tell me what you have"
          className={`flex size-32 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-90 sm:size-36 ${ingredientPhase === "recording" ? "mic-listening" : ""}`}
        >
          {ingredientPhase === "working" ? (
            <Loader2 className="size-11 animate-spin" aria-hidden />
          ) : ingredientPhase === "recording" ? (
            <Square className="size-10" aria-hidden />
          ) : (
            <Mic className="size-11" aria-hidden />
          )}
        </button>
        <p className="mt-5 text-lg font-semibold">
          {ingredientPhase === "recording"
            ? "Listening… tap to finish"
            : ingredientPhase === "working"
              ? "Writing that down…"
              : "Tell me what you have"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap the mic, say your ingredients, then tap again
        </p>
        {error && (
          <p role="status" className="mt-3 max-w-sm text-center text-sm font-medium text-primary">
            {error}
          </p>
        )}
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

      {ingredients.length > 0 && (
        <section className="mt-8 rounded-3xl border border-primary/25 bg-card p-5 shadow-card sm:p-7">
          <h2 className="text-xl">What are you in the mood for?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Say something like &ldquo;something high protein under twenty minutes&rdquo; — or just tap
            the buttons below.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleMoodMic}
              disabled={moodPhase === "working" || ingredientPhase !== "idle"}
              className={`h-14 rounded-full px-6 text-base font-semibold ${moodPhase === "recording" ? "mic-listening" : ""}`}
            >
              {moodPhase === "working" ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : moodPhase === "recording" ? (
                <Square className="size-5" aria-hidden />
              ) : (
                <Mic className="size-5" aria-hidden />
              )}
              {moodPhase === "recording"
                ? "Listening… tap to finish"
                : moodPhase === "working"
                  ? "Working it out…"
                  : "Say what you fancy"}
            </Button>
          </div>
          {heardMood && (
            <div className="mt-4 rounded-2xl bg-secondary p-4">
              <p className="text-sm text-muted-foreground">I heard: &ldquo;{heardMood}&rdquo;</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {[timeLimit, ...goals].map((label) => (
                  <li
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground"
                  >
                    <Check className="size-4" aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">
                Not right? Change anything below before searching.
              </p>
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <h3 className="text-lg font-semibold">How much time do you have?</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {TIME_LIMITS.map((option) => {
            const active = timeLimit === option;
            return (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => setTimeLimit(option)}
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

        <h3 className="mt-6 text-lg font-semibold">Any goals?</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {DIET_GOALS.map((option) => {
            const active = goals.includes(option);
            return (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => toggleGoal(option)}
                  aria-pressed={active}
                  className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
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

        <h3 className="mt-6 text-lg font-semibold">Meal type</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
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
        disabled={ingredients.length === 0 || busy}
        onClick={() => navigate({ to: "/recipes" })}
        className="mt-10 h-16 w-full rounded-full text-lg font-semibold shadow-lift"
      >
        Find recipes
      </Button>
    </main>
  );
}
