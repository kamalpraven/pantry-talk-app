import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) setError(error.message);
    else setMessage("Check your email for a password reset link.");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 pt-24 pb-16">
      <h1 className="text-4xl">Reset your password</h1>
      <p className="mt-3 text-muted-foreground">We'll send a secure link to your email.</p>
      <form
        onSubmit={submit}
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
          />
        </div>
        {error && (
          <p className="text-sm font-medium text-primary" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm font-medium text-primary" role="status">
            {message}
          </p>
        )}
        <Button disabled={!supabase || busy} className="h-12 w-full rounded-full">
          {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />} Send reset link
        </Button>
      </form>
      <Link to="/login" className="mt-5 text-sm font-semibold text-primary">
        Back to sign in
      </Link>
    </main>
  );
}
