import { createFileRoute, Link, useHydrated, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  Mic,
  Square,
  Loader2,
  Volume2,
  Ear,
  Sparkles,
  Minus,
  Star,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StepTimer } from "@/components/StepTimer";
import { lookupRecipe } from "@/lib/recipe-cache";
import { formatSpokenTime, stepTimerSeconds } from "@/lib/recipes";
import {
  speakAloud,
  startRecording,
  stopSpeaking,
  transcribeAudio,
  type Recorder,
} from "@/lib/speech";
import { answerFor, parseCommand } from "@/lib/voice-commands";
import { playChime, useCookingTimer } from "@/lib/use-cooking-timer";
import { useVibe } from "@/lib/vibe-store";
import { usePantry, type ConsumptionEstimate } from "@/lib/pantry-store";
import { formatPantryQuantity } from "@/lib/inventory";
import { trackEvent } from "@/lib/analytics";
import { FavoriteButton } from "@/components/FavoriteButton";
import { useCookingHistory } from "@/lib/cooking-history-store";
import { lookupRecipeWithSnapshot } from "@/lib/recipe-snapshots";

export const Route = createFileRoute("/cook/$recipeId")({
  validateSearch: (search: Record<string, unknown>) => ({
    again: typeof search.again === "string" ? search.again : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Cooking mode — PantryTalk" },
      {
        name: "description",
        content:
          "Hands-free cooking mode: PantryTalk reads each step aloud, listens for your commands and runs your timers.",
      },
      { property: "og:title", content: "Cooking mode — PantryTalk" },
      {
        property: "og:description",
        content:
          "Hands-free cooking mode: PantryTalk reads each step aloud, listens for your commands and runs your timers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CookingMode,
});

type MicPhase = "idle" | "listening" | "working";

function CookingMode() {
  const { recipeId } = Route.useParams();
  const { again } = Route.useSearch();
  const hydrated = useHydrated();
  const history = useCookingHistory();
  const previousSession = again ? history.sessionById(again) : undefined;
  const recipe = hydrated
    ? (lookupRecipeWithSnapshot(recipeId, previousSession?.recipeSnapshot) ??
      lookupRecipe(recipeId))
    : undefined;
  const navigate = useNavigate();
  const { muted, duck, unduck } = useVibe();
  const { pantryItems, previewConsumption, applyConsumption } = usePantry();

  const [index, setIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [micPhase, setMicPhase] = useState<MicPhase>("idle");
  const [handsFree, setHandsFree] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionUpdated, setCompletionUpdated] = useState(false);
  const [consumptionDraft, setConsumptionDraft] = useState<ConsumptionEstimate[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [wouldCookAgain, setWouldCookAgain] = useState<"yes" | "maybe" | "no" | null>(null);
  const [notes, setNotes] = useState("");
  const [substitutions, setSubstitutions] = useState([
    { originalIngredient: "", replacementIngredient: "" },
  ]);
  const recorderRef = useRef<Recorder | null>(null);
  const spokenStep = useRef<number | null>(null);

  const total = recipe?.steps.length ?? 0;
  const step = recipe?.steps[index] ?? "";
  const stepSeconds = step ? stepTimerSeconds(step) : null;
  const last = total > 0 && index === total - 1;

  useEffect(() => {
    if (!recipe || sessionId) return;
    void history
      .startCooking(recipe, {
        forceNew: Boolean(again),
        servings: previousSession?.servings ?? recipe.servings,
        cookedAgain: Boolean(again),
      })
      .then((session) => setSessionId(session.id));
  }, [again, history, previousSession?.servings, recipe, sessionId]);

  const previousSubs = previousSession ? history.substitutionsFor(previousSession.id) : [];

  /* --------------------------------- voice --------------------------------- */

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setSpeaking(true);
      duck();
      try {
        await speakAloud(text);
      } finally {
        unduck();
        setSpeaking(false);
      }
    },
    [duck, unduck],
  );

  const timer = useCookingTimer(() => {
    if (!muted) playChime();
    void speak("Timer's done.");
  });

  const timerRef = useRef(timer);
  timerRef.current = timer;

  // Read each new step aloud. The microphone is never open while this runs.
  useEffect(() => {
    if (!step || spokenStep.current === index) return;
    spokenStep.current = index;
    void speak(step);
  }, [index, step, speak]);

  useEffect(() => () => stopSpeaking(), []);

  const handleCommand = useCallback(
    async (transcript: string) => {
      if (!recipe) return;
      const command = parseCommand(transcript);
      const t = timerRef.current;

      switch (command.kind) {
        case "next":
          if (index < total - 1) setIndex(index + 1);
          else await speak("That was the last step. Enjoy your food.");
          return;
        case "previous":
          if (index > 0) setIndex(index - 1);
          else await speak("You're already on the first step.");
          return;
        case "repeat":
          spokenStep.current = index;
          await speak(step);
          return;
        case "startTimer": {
          const seconds = command.seconds ?? stepSeconds;
          if (!seconds) {
            await speak("This step doesn't have a time. Tell me how many minutes you want.");
            return;
          }
          t.start(seconds);
          await speak(`Timer started for ${formatSpokenTime(seconds)}.`);
          return;
        }
        case "pauseTimer":
          t.pause();
          await speak("Timer paused.");
          return;
        case "resumeTimer":
          t.resume();
          await speak("Timer running again.");
          return;
        case "stopTimer":
          t.stop();
          await speak("Timer stopped.");
          return;
        case "unknown":
          await speak("I didn't catch that. Try next, repeat, or start timer.");
          return;
        default: {
          const answer = answerFor(command, {
            recipe,
            index,
            remainingSeconds: t.active ? t.remaining : null,
            timerActive: t.active,
          });
          if (answer) await speak(answer);
          return;
        }
      }
    },
    [index, recipe, speak, step, stepSeconds, total],
  );

  const toggleMic = useCallback(async () => {
    if (speaking) return;
    setNote(null);

    if (micPhase === "listening" && recorderRef.current) {
      setMicPhase("working");
      try {
        const blob = await recorderRef.current.stop();
        recorderRef.current = null;
        const transcript = await transcribeAudio(blob);
        setHeard(transcript);
        setMicPhase("idle");
        await handleCommand(transcript);
      } catch (error) {
        recorderRef.current = null;
        setMicPhase("idle");
        setNote(error instanceof Error ? error.message : "I didn't catch that. Try again.");
      }
      return;
    }

    try {
      recorderRef.current = await startRecording();
      setMicPhase("listening");
    } catch {
      setMicPhase("idle");
      setNote("I can't reach your microphone — use the buttons below.");
    }
  }, [handleCommand, micPhase, speaking]);

  // Hands-free: open the mic once the chef has finished speaking.
  useEffect(() => {
    if (!handsFree || speaking || micPhase !== "idle") return;
    const id = window.setTimeout(() => void toggleMic(), 600);
    return () => window.clearTimeout(id);
  }, [handsFree, speaking, micPhase, toggleMic]);

  function finishCooking() {
    if (!recipe) return;
    stopSpeaking();
    setHandsFree(false);
    const estimates = previewConsumption(recipe);
    setConsumptionDraft(estimates);
    trackEvent("meal_completed", { recipeId: recipe.id, trackedIngredients: estimates.length });
    setCompletionUpdated(false);
    setCompletionOpen(true);
  }

  async function markSessionComplete(extra?: {
    rating?: number | null;
    wouldCookAgain?: "yes" | "maybe" | "no" | null;
    notes?: string | null;
    substitutions?: { originalIngredient: string; replacementIngredient: string }[];
  }) {
    if (!sessionId) return;
    await history.completeSession(sessionId, {
      rating: extra?.rating ?? null,
      wouldCookAgain: extra?.wouldCookAgain ?? null,
      notes: extra?.notes ?? null,
      substitutions: extra?.substitutions ?? [],
    });
  }

  async function confirmConsumption() {
    if (!recipe) return;
    const confirmed = consumptionDraft.filter((item) => item.quantity > 0);
    applyConsumption(recipe, confirmed);
    trackEvent("inventory_update_confirmed", {
      recipeId: recipe.id,
      updatedIngredients: confirmed.length,
    });
    await markSessionComplete();
    setCompletionUpdated(true);
    void speak("Kitchen updated. Your next meal recommendations are already smarter.");
  }

  async function skipInventoryUpdate() {
    await markSessionComplete();
    navigate({ to: "/recipes" });
  }

  async function saveFeedback() {
    await markSessionComplete({
      rating,
      wouldCookAgain,
      notes,
      substitutions: substitutions.filter(
        (item) => item.originalIngredient.trim() && item.replacementIngredient.trim(),
      ),
    });
    navigate({ to: "/history" });
  }

  if (!recipe) {
    if (!hydrated) return <main className="min-h-screen" />;
    return (
      <main className="mx-auto w-full max-w-3xl px-5 pt-28 pb-20 sm:px-8">
        <h1 className="text-3xl">That recipe isn&rsquo;t loaded</h1>
        <Button asChild className="mt-6 h-14 rounded-full px-6 text-base">
          <Link to="/recipes">Back to recipes</Link>
        </Button>
      </main>
    );
  }

  if (completionOpen) {
    return (
      <main className="min-h-screen px-5 pt-24 pb-12 sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <button
            type="button"
            onClick={() => setCompletionOpen(false)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to cooking
          </button>

          {!completionUpdated ? (
            <>
              <div className="mt-10 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Check className="size-8" aria-hidden />
                </div>
                <h1 className="mt-5 text-4xl">Dinner&rsquo;s done.</h1>
                <p className="mx-auto mt-3 max-w-lg text-base text-muted-foreground">
                  Pantry Talk estimates what left your kitchen from this recipe. Confirm or adjust
                  it before the pantry updates.
                </p>
              </div>

              <section className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-card sm:p-7">
                <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                  <Sparkles className="size-4 text-primary" aria-hidden />
                  Pantry Talk thinks you used
                </p>

                {consumptionDraft.length ? (
                  <ul className="mt-5 space-y-3">
                    {consumptionDraft.map((item, itemIndex) => (
                      <li
                        key={item.pantryItemId}
                        className="flex items-center justify-between gap-4 rounded-2xl bg-secondary p-4"
                      >
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {Math.round(item.confidence * 100)}% estimate confidence
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Minus className="size-4 text-primary" aria-hidden />
                          <Input
                            type="number"
                            min={0}
                            step={item.unit === "count" ? 1 : 5}
                            value={item.quantity}
                            onChange={(event) => {
                              const quantity = Math.max(0, Number(event.target.value) || 0);
                              setConsumptionDraft((current) =>
                                current.map((candidate, index) =>
                                  index === itemIndex ? { ...candidate, quantity } : candidate,
                                ),
                              );
                            }}
                            aria-label={`Amount of ${item.name} used`}
                            className="h-10 w-24 rounded-full bg-card text-right"
                          />
                          <span className="w-10 text-sm font-semibold text-muted-foreground">
                            {item.unit === "count" ? "items" : item.unit}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
                    None of this recipe&rsquo;s ingredients match the pantry items we&rsquo;re
                    currently tracking.
                  </p>
                )}

                <Button
                  onClick={() => void confirmConsumption()}
                  className="mt-6 h-14 w-full rounded-full text-base font-semibold"
                >
                  Looks right — update my kitchen
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void skipInventoryUpdate()}
                  className="mt-2 h-12 w-full rounded-full"
                >
                  Skip update
                </Button>
              </section>
            </>
          ) : (
            <>
              <div className="mt-10 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift">
                  <Sparkles className="size-8" aria-hidden />
                </div>
                <h1 className="mt-5 text-4xl">Kitchen updated.</h1>
                <p className="mx-auto mt-3 max-w-lg text-base text-muted-foreground">
                  You don&rsquo;t have to remember what changed. Pantry Talk carries the kitchen
                  state into the next decision.
                </p>
              </div>

              <section className="mt-8 rounded-3xl border border-primary/20 bg-card p-5 shadow-card sm:p-7">
                <h2 className="text-xl">How was it?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Optional — this helps PantryTalk remember what you loved.
                </p>
                <div className="mt-4 flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      aria-label={`Rate ${value} out of 5`}
                      className={`flex size-10 items-center justify-center rounded-full border ${
                        rating != null && value <= rating
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-secondary"
                      }`}
                    >
                      <Star className="size-4" aria-hidden />
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    ["yes", "Yes"],
                    ["maybe", "Maybe"],
                    ["no", "No"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWouldCookAgain(value as "yes" | "maybe" | "no")}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                        wouldCookAgain === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-secondary"
                      }`}
                    >
                      Cook again? {label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Notes, tweaks, or what you changed"
                  className="mt-4 min-h-24 w-full rounded-2xl border border-border bg-background p-3 text-sm"
                />
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">Substitutions</p>
                  {previousSubs.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Last time:{" "}
                      {previousSubs
                        .map((sub) => `${sub.originalIngredient} → ${sub.replacementIngredient}`)
                        .join(" · ")}
                    </p>
                  )}
                  {substitutions.map((substitution, substitutionIndex) => (
                    <div key={substitutionIndex} className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={substitution.originalIngredient}
                        onChange={(event) =>
                          setSubstitutions((current) =>
                            current.map((item, index) =>
                              index === substitutionIndex
                                ? { ...item, originalIngredient: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Original ingredient"
                      />
                      <Input
                        value={substitution.replacementIngredient}
                        onChange={(event) =>
                          setSubstitutions((current) =>
                            current.map((item, index) =>
                              index === substitutionIndex
                                ? { ...item, replacementIngredient: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Replacement"
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setSubstitutions((current) => [
                        ...current,
                        { originalIngredient: "", replacementIngredient: "" },
                      ])
                    }
                    className="rounded-full"
                  >
                    <Plus className="size-4" aria-hidden /> Add substitution
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button onClick={() => void saveFeedback()} className="rounded-full">
                    Save feedback
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate({ to: "/recipes" })}
                    className="rounded-full"
                  >
                    Skip feedback
                  </Button>
                </div>

                <h2 className="mt-8 text-xl">What&rsquo;s left</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {consumptionDraft.map((used) => {
                    const remaining = pantryItems.find((item) => item.id === used.pantryItemId);
                    if (!remaining) return null;
                    return (
                      <li key={used.pantryItemId} className="rounded-2xl bg-secondary p-4">
                        <p className="font-semibold">{remaining.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          ~{formatPantryQuantity(remaining.quantityEstimate, remaining.unit)}{" "}
                          remaining · {Math.round(remaining.confidence * 100)}% confidence
                        </p>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-6 rounded-2xl bg-accent p-4 text-accent-foreground">
                  <p className="font-semibold">Pantry Talk closed the loop.</p>
                  <p className="mt-1 text-sm">
                    {consumptionDraft.length} tracked ingredient
                    {consumptionDraft.length === 1 ? "" : "s"} updated from one cooking session.
                  </p>
                </div>

                <Button
                  onClick={() => navigate({ to: "/recipes" })}
                  className="mt-6 h-14 w-full rounded-full text-base font-semibold"
                >
                  See what I can cook next
                </Button>
              </section>
            </>
          )}
        </div>
      </main>
    );
  }

  const progress = ((index + 1) / total) * 100;
  const status = speaking
    ? "Chef speaking…"
    : micPhase === "listening"
      ? "Listening for a command…"
      : micPhase === "working"
        ? "Working that out…"
        : handsFree
          ? "Listening for a command…"
          : "Tap the mic to speak";

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
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-lg font-semibold">{recipe.name}</p>
            <FavoriteButton recipe={recipe} compact className="h-10 rounded-full px-3" />
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
          <p className="mt-2 text-sm text-muted-foreground">
            {recipe.nutrition.calories} kcal · {recipe.nutrition.protein}g protein / serving
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-10">
          <p className="max-w-2xl text-center text-3xl leading-snug font-medium sm:text-4xl md:text-5xl md:leading-tight">
            {step}
          </p>

          <StepTimer timer={timer} stepSeconds={stepSeconds} />

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void toggleMic()}
              disabled={speaking || micPhase === "working"}
              aria-label="Hold a conversation with the chef"
              className={`flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60 ${
                micPhase === "listening" ? "mic-listening" : ""
              }`}
            >
              {micPhase === "working" ? (
                <Loader2 className="size-9 animate-spin" aria-hidden />
              ) : micPhase === "listening" ? (
                <Square className="size-8" aria-hidden />
              ) : (
                <Mic className="size-9" aria-hidden />
              )}
            </button>
            <p role="status" className="flex items-center gap-2 text-base font-semibold">
              {speaking ? (
                <Volume2 className="size-4 text-primary" aria-hidden />
              ) : (
                <Ear className="size-4 text-primary" aria-hidden />
              )}
              {status}
            </p>
            <button
              type="button"
              onClick={() => setHandsFree((v) => !v)}
              aria-pressed={handsFree}
              className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                handsFree
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent"
              }`}
            >
              Hands-free voice {handsFree ? "on" : "off"}
            </button>
            {heard && (
              <p className="text-sm text-muted-foreground">You said: &ldquo;{heard}&rdquo;</p>
            )}
            {note && <p className="text-sm font-medium text-primary">{note}</p>}
          </div>
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
            onClick={() => void speak(step)}
            className="h-20 rounded-3xl text-base font-semibold sm:text-lg"
          >
            <RotateCcw className="size-6" aria-hidden />
            Repeat
          </Button>
          {last ? (
            <Button
              onClick={finishCooking}
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
