import { Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVibe, VIBE_GENRES } from "@/lib/vibe-store";

/**
 * Compact persistent music control.
 * Swap point: replace the mock state in `vibe-store` with real audio playback
 * or ElevenLabs-generated music.
 */
export function CookingVibe() {
  const { genre, setGenre, playing, togglePlay, muted, toggleMute } = useVibe();

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/90 p-1.5 pl-3 shadow-card backdrop-blur">
      <Music2 className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="hidden text-sm font-medium sm:inline">Cooking Vibe</span>

      <Select value={genre} onValueChange={setGenre}>
        <SelectTrigger
          aria-label="Cooking vibe genre"
          className="h-9 w-[104px] rounded-full border-border bg-secondary text-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VIBE_GENRES.map((g) => (
            <SelectItem key={g} value={g}>
              {g}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pause music" : "Play music"}
        className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>

      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute music" : "Mute music"}
        className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent"
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>
    </div>
  );
}
