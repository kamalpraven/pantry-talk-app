import { useCallback, useEffect, useRef, useState } from "react";

export type CookingTimer = {
  /** Total length of the current timer in seconds. */
  seconds: number;
  remaining: number;
  running: boolean;
  active: boolean;
  done: boolean;
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
};

/**
 * A single cooking timer, driven by wall-clock deadlines so it stays accurate
 * when the tab is throttled. Completely independent of the Cooking Vibe music.
 */
export function useCookingTimer(onDone: () => void): CookingTimer {
  const [seconds, setSeconds] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);
  const deadline = useRef<number | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (deadline.current === null) return;
      const left = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        setDone(true);
        deadline.current = null;
        doneRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running]);

  const start = useCallback((value: number) => {
    if (value <= 0) return;
    setSeconds(value);
    setRemaining(value);
    setDone(false);
    setActive(true);
    deadline.current = Date.now() + value * 1000;
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (deadline.current === null) return;
    setRemaining(Math.max(0, Math.round((deadline.current - Date.now()) / 1000)));
    deadline.current = null;
    setRunning(false);
  }, []);

  const resume = useCallback(() => {
    setRemaining((left) => {
      if (left > 0) {
        deadline.current = Date.now() + left * 1000;
        setRunning(true);
      }
      return left;
    });
  }, []);

  const stop = useCallback(() => {
    deadline.current = null;
    setRunning(false);
    setActive(false);
    setDone(false);
    setRemaining(0);
    setSeconds(0);
  }, []);

  const reset = useCallback(() => {
    deadline.current = null;
    setRunning(false);
    setDone(false);
    setRemaining(seconds);
  }, [seconds]);

  return { seconds, remaining, running, active, done, start, pause, resume, stop, reset };
}

export function playChime() {
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
