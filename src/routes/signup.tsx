import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const supabase = getSupabaseBrowserClient();

  async function signUp(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy("email");
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() || null },
        emailRedirectTo: `${window.location.origin}/account`,
      },
    });
    setBusy(null);
    if (error) setError(error.message);
    else if (data.session) {
      await auth.refresh();
      await navigate({ to: "/account" });
    } else setStatus("Check your email to confirm your PantryTalk account.");
  }

  async function signUpWithGoogle() {
    if (!supabase) return;
    setBusy("google");
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/account` },
    });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 pt-24 pb-16">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">PantryTalk</p>
      <h1 className="mt-3 text-4xl">Create your kitchen profile</h1>
      <p className="mt-3 text-muted-foreground">
        Start saving your pantry and preferences. Guest mode remains available anytime.
      </p>
      {!supabase && (
        <p className="mt-6 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
          Supabase is not configured yet.
        </p>
      )}
      <form
        onSubmit={signUp}
        className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card"
      >
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        {error && (
          <p className="text-sm font-medium text-primary" role="alert">
            {error}
          </p>
        )}
        {status && (
          <p className="text-sm font-medium text-primary" role="status">
            {status}
          </p>
        )}
        <Button
          type="submit"
          disabled={!supabase || busy !== null}
          className="h-12 w-full rounded-full"
        >
          {busy === "email" && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />} Sign up
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!supabase || busy !== null}
          onClick={signUpWithGoogle}
          className="h-12 w-full rounded-full"
        >
          Continue with Google
        </Button>
        <p className="text-xs text-muted-foreground">
          Apple OAuth can be enabled by adding an Apple provider in Supabase and wiring the same
          OAuth helper.
        </p>
      </form>
      <p className="mt-5 text-sm">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary">
          Sign in
        </Link>
      </p>
    </main>
  );
}
