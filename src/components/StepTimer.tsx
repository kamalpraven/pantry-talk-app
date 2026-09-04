import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer as TimerIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimer, timerLabel } from "@/lib/recipes";

/**
 * Smart cooking timer for a single step. Fully independent of the Cooking Vibe
 * music control — it owns its own short chime.
 */
function playChime() {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.28);
    osc.connect(gain);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
    osc.onended = () => void ctx.close();
  } catch {
    // audio unavailable — the visual completion state is enough
  }
}

export function StepTimer({ seconds, soundEnabled }: { seconds: number; soundEnabled: boolean }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const chimed = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    setRunning(false);
    setStarted(false);
    chimed.current = false;
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining !== 0 || !started || chimed.current) return;
    chimed.current = true;
    setRunning(false);
    if (soundEnabled) playChime();
  }, [remaining, started, soundEnabled]);

  const done = started && remaining === 0;

  if (!started) {
    return (
      <Button
        variant="outline"
        onClick={() => {
          setStarted(true);
          setRunning(true);
        }}
        className="h-14 rounded-full border-primary/40 px-6 text-base font-semibold text-primary"
      >
        <TimerIcon className="size-5" aria-hidden />
        {timerLabel(seconds)}
      </Button>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-4 rounded-3xl border px-6 py-5 ${
        done ? "border-primary bg-accent" : "border-border bg-card"
      }`}
      aria-live="polite"
    >
      <p className="flex items-center gap-3 text-4xl font-semibold tabular-nums sm:text-5xl">
        {done ? (
          <>
            <Check className="size-8 text-primary" aria-hidden />
            <span className="text-3xl sm:text-4xl">Time&rsquo;s up</span>
          </>
        ) : (
          formatTimer(remaining)
        )}
      </p>
      <div className="flex gap-2">
        {!done && (
          <Button
            variant="secondary"
            onClick={() => setRunning((r) => !r)}
            className="h-14 rounded-full px-6 text-base font-semibold"
          >
            {running ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
            {running ? "Pause" : "Resume"}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            setRemaining(seconds);
            setRunning(false);
            setStarted(false);
            chimed.current = false;
          }}
          className="h-14 rounded-full px-6 text-base font-semibold"
        >
          <RotateCcw className="size-5" aria-hidden />
          Reset
        </Button>
      </div>
    </div>
  );
}
