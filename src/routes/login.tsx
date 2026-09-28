import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-store";

function safeRedirect(value: unknown) {
  if (typeof value !== "string") return "/account";
  if (!value.startsWith("/") || value.startsWith("//")) return "/account";
  return value;
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeRedirect(search.redirect),
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"password" | "magic" | "google" | null>(null);

  const supabase = getSupabaseBrowserClient();
  const disabled = !supabase || busy !== null;

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy("password");
    setError(null);
    setStatus(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error) setError(error.message);
    else {
      await auth.refresh();
      await navigate({ to: redirect || "/account" });
    }
  }

  async function sendMagicLink() {
    if (!supabase) return;
    setBusy("magic");
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${redirect || "/account"}` },
    });
    setBusy(null);
    if (error) setError(error.message);
    else setStatus("Check your email for a magic sign-in link.");
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setBusy("google");
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${redirect || "/account"}` },
    });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 pt-24 pb-16">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">PantryTalk</p>
      <h1 className="mt-3 text-4xl">Welcome back</h1>
      <p className="mt-3 text-muted-foreground">
        Sign in to save your pantry and profile. You can still cook as a guest.
      </p>

      {!supabase && (
        <p className="mt-6 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
          Supabase is not configured yet. Add the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
          environment variables to enable sign-in.
        </p>
      )}

      <form
        onSubmit={signInWithPassword}
        className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card"
      >
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
            autoComplete="current-password"
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
        <Button type="submit" disabled={disabled} className="h-12 w-full rounded-full">
          {busy === "password" && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />} Sign
          in
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || !email}
          onClick={sendMagicLink}
          className="h-12 w-full rounded-full"
        >
          {busy === "magic" ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Mail className="mr-2 size-4" aria-hidden />
          )}{" "}
          Email me a magic link
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={signInWithGoogle}
          className="h-12 w-full rounded-full"
        >
          Continue with Google
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
        <Link to="/signup" className="text-primary">
          Create account
        </Link>
        <Link to="/forgot-password" className="text-primary">
          Forgot password?
        </Link>
        <Link to="/" className="text-muted-foreground">
          Continue as guest
        </Link>
      </div>
    </main>
  );
}
