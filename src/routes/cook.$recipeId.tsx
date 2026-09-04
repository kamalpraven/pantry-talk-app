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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepTimer } from "@/components/StepTimer";
import { lookupRecipe } from "@/lib/recipe-cache";
import { formatSpokenTime, stepTimerSeconds } from "@/lib/recipes";
import { speakAloud, startRecording, stopSpeaking, transcribeAudio, type Recorder } from "@/lib/speech";
import { answerFor, parseCommand } from "@/lib/voice-commands";
import { playChime, useCookingTimer } from "@/lib/use-cooking-timer";
import { useVibe } from "@/lib/vibe-store";

export const Route = createFileRoute("/cook/$recipeId")({
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
  const hydrated = useHydrated();
  const recipe = hydrated ? lookupRecipe(recipeId) : undefined;
  const navigate = useNavigate();
  const { muted, duck, unduck } = useVibe();

  const [index, setIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [micPhase, setMicPhase] = useState<MicPhase>("idle");
  const [handsFree, setHandsFree] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const spokenStep = useRef<number | null>(null);

  const total = recipe?.steps.length ?? 0;
  const step = recipe?.steps[index] ?? "";
  const stepSeconds = step ? stepTimerSeconds(step) : null;
  const last = total > 0 && index === total - 1;

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
            {heard && <p className="text-sm text-muted-foreground">You said: &ldquo;{heard}&rdquo;</p>}
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
