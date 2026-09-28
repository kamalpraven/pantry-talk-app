import { Link, useLocation } from "@tanstack/react-router";
import { Loader2, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-5">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Checking your session…
        </p>
      </main>
    );
  }

  if (!auth.user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-5">
        <section className="rounded-3xl border border-border bg-card p-7 text-center shadow-card">
          <LockKeyhole className="mx-auto size-8 text-primary" aria-hidden />
          <h1 className="mt-4 text-3xl">Sign in to continue</h1>
          <p className="mt-2 text-muted-foreground">
            PantryTalk still works as a guest, but this page belongs to your account.
          </p>
          <Button asChild className="mt-6 h-12 rounded-full px-6">
            <Link to="/login" search={{ redirect: location.href }}>
              Sign in
            </Link>
          </Button>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
