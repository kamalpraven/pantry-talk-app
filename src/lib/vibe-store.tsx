import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const VIBE_GENRES = [
  "Lo-fi",
  "EDM",
  "Techno",
  "Slow",
  "Acoustic",
  "Jazz",
  "Classical",
  "Upbeat",
] as const;

export type VibeGenre = (typeof VIBE_GENRES)[number];

/**
 * Each vibe maps to a bundled, demo-safe audio loop in /public/audio.
 * Several genres intentionally share a track so no vibe is ever silent.
 */
const GENRE_TRACKS: Record<VibeGenre, string> = {
  "Lo-fi": "/audio/lofi.mp3",
  EDM: "/audio/energetic.mp3",
  Techno: "/audio/energetic.mp3",
  Slow: "/audio/mellow.mp3",
  Acoustic: "/audio/lofi.mp3",
  Jazz: "/audio/lofi.mp3",
  Classical: "/audio/mellow.mp3",
  Upbeat: "/audio/energetic.mp3",
};

const BASE_VOLUME = 0.3;
const DUCKED_VOLUME = 0.1;
const MUSIC_ERROR = "Music unavailable — try another vibe.";

type VibeState = {
  genre: VibeGenre;
  playing: boolean;
  muted: boolean;
  loading: boolean;
  error: string | null;
  setGenre: (genre: string) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  /** Lower the music while the chef speaks. */
  duck: () => void;
  /** Restore the listener's music level. */
  unduck: () => void;
};

const VibeContext = createContext<VibeState | null>(null);

function rampTo(audio: HTMLAudioElement, target: number) {
  const start = audio.volume;
  const steps = 8;
  let i = 0;
  const id = window.setInterval(() => {
    i += 1;
    audio.volume = Math.max(0, Math.min(1, start + ((target - start) * i) / steps));
    if (i >= steps) window.clearInterval(id);
  }, 40);
}

export function VibeProvider({ children }: { children: ReactNode }) {
  const [genre, setGenreState] = useState<VibeGenre>("Lo-fi");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const duckedRef = useRef(false);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = BASE_VOLUME;
    audio.src = GENRE_TRACKS["Lo-fi"];
    audioRef.current = audio;

    const onWaiting = () => setLoading(true);
    const onReady = () => setLoading(false);
    const onError = () => {
      setLoading(false);
      setPlaying(false);
      playingRef.current = false;
      setError(MUSIC_ERROR);
    };
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onReady);
    audio.addEventListener("playing", onReady);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("playing", onReady);
      audio.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = muted;
  }, [muted]);

  const setGenre = useCallback((next: string) => {
    const value = next as VibeGenre;
    setGenreState(value);
    const audio = audioRef.current;
    if (!audio) return;
    const track = GENRE_TRACKS[value];
    if (!track) return;
    setError(null);
    const wasPlaying = playingRef.current;
    audio.src = track;
    if (!wasPlaying) return;
    setLoading(true);
    audio
      .play()
      .then(() => setLoading(false))
      .catch(() => {
        setLoading(false);
        setPlaying(false);
        playingRef.current = false;
        setError(MUSIC_ERROR);
      });
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingRef.current) {
      audio.pause();
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await audio.play();
      playingRef.current = true;
      setPlaying(true);
    } catch {
      setError(MUSIC_ERROR);
    } finally {
      setLoading(false);
    }
  }, []);

  const duck = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || duckedRef.current) return;
    duckedRef.current = true;
    rampTo(audio, DUCKED_VOLUME);
  }, []);

  const unduck = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !duckedRef.current) return;
    duckedRef.current = false;
    rampTo(audio, BASE_VOLUME);
  }, []);

  const value = useMemo<VibeState>(
    () => ({
      genre,
      playing,
      muted,
      loading,
      error,
      setGenre,
      togglePlay: () => void togglePlay(),
      toggleMute: () => setMuted((m) => !m),
      duck,
      unduck,
    }),
    [genre, playing, muted, loading, error, setGenre, togglePlay, duck, unduck],
  );

  return <VibeContext.Provider value={value}>{children}</VibeContext.Provider>;
}

export function useVibe() {
  const ctx = useContext(VibeContext);
  if (!ctx) throw new Error("useVibe must be used inside VibeProvider");
  return ctx;
}
