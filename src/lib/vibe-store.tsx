import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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

type VibeState = {
  genre: VibeGenre;
  playing: boolean;
  muted: boolean;
  setGenre: (genre: string) => void;
  togglePlay: () => void;
  toggleMute: () => void;
};

const VibeContext = createContext<VibeState | null>(null);

export function VibeProvider({ children }: { children: ReactNode }) {
  const [genre, setGenreState] = useState<VibeGenre>("Lo-fi");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const value = useMemo<VibeState>(
    () => ({
      genre,
      playing,
      muted,
      setGenre: (next: string) => setGenreState(next as VibeGenre),
      togglePlay: () => setPlaying((p) => !p),
      toggleMute: () => setMuted((m) => !m),
    }),
    [genre, playing, muted],
  );

  return <VibeContext.Provider value={value}>{children}</VibeContext.Provider>;
}

export function useVibe() {
  const ctx = useContext(VibeContext);
  if (!ctx) throw new Error("useVibe must be used inside VibeProvider");
  return ctx;
}
