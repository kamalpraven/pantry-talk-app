import { Pause, Play, RotateCcw, Timer as TimerIcon, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimer, timerLabel } from "@/lib/recipes";
import type { CookingTimer } from "@/lib/use-cooking-timer";

/**
 * Presentational timer panel. All state lives in `useCookingTimer` so spoken
 * commands and the buttons drive exactly the same timer.
 */
export function StepTimer({ timer, stepSeconds }: { timer: CookingTimer; stepSeconds: number | null }) {
  if (!timer.active) {
    if (stepSeconds === null) return null;
    return (
      <Button
        variant="outline"
        onClick={() => timer.start(stepSeconds)}
        className="h-14 rounded-full border-primary/40 px-6 text-base font-semibold text-primary"
      >
        <TimerIcon className="size-5" aria-hidden />
        {timerLabel(stepSeconds)}
      </Button>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-4 rounded-3xl border px-6 py-5 ${
        timer.done ? "border-primary bg-accent" : "border-border bg-card"
      }`}
      aria-live="polite"
    >
      <p className="flex items-center gap-3 text-4xl font-semibold tabular-nums sm:text-5xl">
        {timer.done ? (
          <>
            <Check className="size-8 text-primary" aria-hidden />
            <span className="text-3xl sm:text-4xl">Time&rsquo;s up</span>
          </>
        ) : (
          formatTimer(timer.remaining)
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {!timer.done && (
          <Button
            variant="secondary"
            onClick={() => (timer.running ? timer.pause() : timer.resume())}
            className="h-14 rounded-full px-6 text-base font-semibold"
          >
            {timer.running ? (
              <Pause className="size-5" aria-hidden />
            ) : (
              <Play className="size-5" aria-hidden />
            )}
            {timer.running ? "Pause" : "Resume"}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => timer.reset()}
          className="h-14 rounded-full px-6 text-base font-semibold"
        >
          <RotateCcw className="size-5" aria-hidden />
          Reset
        </Button>
        <Button
          variant="ghost"
          onClick={() => timer.stop()}
          className="h-14 rounded-full px-6 text-base font-semibold"
        >
          <X className="size-5" aria-hidden />
          Stop
        </Button>
      </div>
    </div>
  );
}
