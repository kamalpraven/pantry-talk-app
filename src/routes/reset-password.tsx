import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) {
      setCheckingRecovery(false);
      return;
    }

    const urlContainsRecovery =
      window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery");

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoveryReady(true);
        setError(null);
      }
    });

    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (urlContainsRecovery && sessionData.session) {
        setRecoveryReady(true);
      } else if (!urlContainsRecovery) {
        setError("Open the password reset link from your email before choosing a new password.");
      }
      setCheckingRecovery(false);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !recoveryReady) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else await navigate({ to: "/account" });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 pt-24 pb-16">
      <h1 className="text-4xl">Choose a new password</h1>
      <p className="mt-3 text-muted-foreground">
        For your security, this form only unlocks from a valid password-reset email link.
      </p>
      <form
        onSubmit={submit}
        className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card"
      >
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error && (
          <p className="text-sm font-medium text-primary" role="alert">
            {error}
          </p>
        )}
        <Button
          disabled={!supabase || checkingRecovery || !recoveryReady || busy}
          className="h-12 w-full rounded-full"
        >
          {(busy || checkingRecovery) && (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          )}
          {checkingRecovery ? "Checking reset link…" : "Update password"}
        </Button>
      </form>
      <Link to="/login" className="mt-5 text-sm font-semibold text-primary">
        Back to sign in
      </Link>
    </main>
  );
}
