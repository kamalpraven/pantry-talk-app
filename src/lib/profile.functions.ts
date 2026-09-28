import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { foodPreferencesUpdateSchema, profileUpdateSchema } from "./profile-types";
import { getSupabaseServerClient, requireSupabaseUser } from "./supabase.server";

const authedInputSchema = z.object({ accessToken: z.string().min(1) });

export const getAccountProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => authedInputSchema.parse(input))
  .handler(async ({ data }) => {
    const user = await requireSupabaseUser(data.accessToken);
    const supabase = getSupabaseServerClient(data.accessToken);

    await supabase
      .from("profiles")
      .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
    await supabase
      .from("food_preferences")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });

    const [
      { data: profile, error: profileError },
      { data: foodPreferences, error: preferencesError },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("food_preferences").select("*").eq("user_id", user.id).single(),
    ]);

    if (profileError) throw new Error(profileError.message);
    if (preferencesError) throw new Error(preferencesError.message);

    return { user: { id: user.id, email: user.email ?? null }, profile, foodPreferences };
  });

export const updateAccountProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ accessToken: z.string().min(1), profile: profileUpdateSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSupabaseUser(data.accessToken);
    const supabase = getSupabaseServerClient(data.accessToken);
    const { onboarding_completed, ...profilePatch } = data.profile;
    const patch = {
      ...profilePatch,
      ...(onboarding_completed ? { onboarding_completed_at: new Date().toISOString() } : {}),
    };
    const { data: profile, error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...patch }, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return profile;
  });

export const updateFoodPreferences = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ accessToken: z.string().min(1), foodPreferences: foodPreferencesUpdateSchema })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireSupabaseUser(data.accessToken);
    const supabase = getSupabaseServerClient(data.accessToken);
    const { data: foodPreferences, error } = await supabase
      .from("food_preferences")
      .upsert({ user_id: user.id, ...data.foodPreferences }, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return foodPreferences;
  });
