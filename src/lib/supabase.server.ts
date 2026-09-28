import "@tanstack/react-start/server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "./database.types";

function env(name: string) {
  return process.env[name];
}

export function getSupabaseServerClient(accessToken?: string): SupabaseClient<Database> {
  const url = env("VITE_SUPABASE_URL") ?? env("SUPABASE_URL");
  const anonKey = env("VITE_SUPABASE_ANON_KEY") ?? env("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  const url = env("VITE_SUPABASE_URL") ?? env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin client is not configured. Set SUPABASE_SERVICE_ROLE_KEY server-side only.",
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireSupabaseUser(accessToken: string | undefined): Promise<User> {
  if (!accessToken) throw new Error("Not authenticated");
  const supabase = getSupabaseServerClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Not authenticated");
  return data.user;
}
