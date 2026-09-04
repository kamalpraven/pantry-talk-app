import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Navigation, ShoppingCart, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findGroceryStores, type GroceryStore } from "@/lib/linkup.functions";

/**
 * Buy-missing-ingredients panel. Store results keep full address and
 * latitude/longitude so an interactive map can be layered on later without
 * changing the backend shape.
 */
export function GroceryFinder({ missing }: { missing: string[] }) {
  const search = useServerFn(findGroceryStores);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"zip" | "address">("zip");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<GroceryStore[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState<{ kind: "zip" | "address"; location: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const result = await search({ data: { location, kind, missing } });
      setStores(result.stores);
      setError(result.error);
      setSearched({ kind, location });
    } catch {
      setStores([]);
      setError("Nearby grocery search is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  const distanceLabel =
    searched?.kind === "zip"
      ? `Estimated distance from ZIP ${searched.location}`
      : "Estimated distance from your address";

  return (
    <section className="mt-6 rounded-2xl border border-primary/25 bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <ShoppingCart className="size-4 text-primary" aria-hidden />
        Buy missing ingredients
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{missing.join(" · ")}</p>

      {!open ? (
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          className="mt-4 h-12 rounded-full px-6 text-base font-semibold"
        >
          <MapPin className="size-4" aria-hidden />
          Find nearby groceries
        </Button>
      ) : (
        <div className="mt-4">
          <div className="flex gap-2">
            {(["zip", "address"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                aria-pressed={kind === option}
                className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  kind === option
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-accent"
                }`}
              >
                {option === "zip" ? "ZIP code" : "Full address"}
              </button>
            ))}
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (location.trim().length >= 3 && !loading) void run();
            }}
          >
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              inputMode={kind === "zip" ? "numeric" : "text"}
              placeholder={kind === "zip" ? "95035" : "123 Example St, San Jose"}
              aria-label={kind === "zip" ? "ZIP code" : "Full address"}
              className="h-12 rounded-full bg-secondary px-5 text-base"
            />
            <Button
              type="submit"
              disabled={loading || location.trim().length < 3}
              className="h-12 shrink-0 rounded-full px-6 text-base font-semibold"
            >
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Find stores
            </Button>
          </form>

          {error && (
            <p role="status" className="mt-3 text-sm font-medium text-primary">
              {error}
            </p>
          )}

          {stores.length > 0 && (
            <>
              <p className="mt-4 text-sm text-muted-foreground">{distanceLabel}</p>
              <ul className="mt-3 space-y-3">
                {stores.map((store) => (
                  <li key={store.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(store.id === selected ? null : store.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                        selected === store.id
                          ? "border-primary bg-accent"
                          : "border-border bg-secondary hover:bg-accent"
                      }`}
                    >
                      <p className="text-base font-semibold">{store.name}</p>
                      {store.estimated_distance_miles !== null && (
                        <p className="text-sm font-medium text-primary">
                          {store.estimated_distance_miles} mi estimated
                        </p>
                      )}
                      <p className="mt-1 text-sm text-muted-foreground">{store.address}</p>
                      {missing.length > 0 && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Likely useful for: {missing.join(" · ")}
                        </p>
                      )}
                    </button>
                    <div className="mt-2 flex flex-wrap gap-3 pl-1">
                      <a
                        href={store.directions_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                      >
                        <Navigation className="size-4" aria-hidden />
                        Directions
                      </a>
                      {store.url && (
                        <a
                          href={store.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                        >
                          <ExternalLink className="size-4" aria-hidden />
                          Store site
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                Distances are estimates, not driving directions.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
