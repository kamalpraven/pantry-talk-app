import { z } from "zod";

export const cookingSkills = ["beginner", "confident", "advanced"] as const;
export const preferredUnits = ["us", "metric"] as const;

export type CookingSkill = (typeof cookingSkills)[number];
export type PreferredUnits = (typeof preferredUnits)[number];

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  household_size: number | null;
  cooking_skill: CookingSkill | null;
  default_servings: number | null;
  preferred_units: PreferredUnits;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FoodPreferences = {
  user_id: string;
  favorite_cuisines: string[];
  disliked_ingredients: string[];
  dietary_preferences: string[];
  allergies: string[];
  desired_cooking_time_minutes: number | null;
  meal_preferences: string[];
  grocery_budget_preference: string | null;
  created_at: string;
  updated_at: string;
};

const listSchema = z.array(z.string().trim().min(1).max(64)).max(30).default([]);

export const profileUpdateSchema = z.object({
  display_name: z.string().trim().max(80).nullable().optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
  household_size: z.number().int().min(1).max(20).nullable().optional(),
  cooking_skill: z.enum(cookingSkills).nullable().optional(),
  default_servings: z.number().int().min(1).max(20).nullable().optional(),
  preferred_units: z.enum(preferredUnits).optional(),
  onboarding_completed: z.boolean().optional(),
});

export const foodPreferencesUpdateSchema = z.object({
  favorite_cuisines: listSchema.optional(),
  disliked_ingredients: listSchema.optional(),
  dietary_preferences: listSchema.optional(),
  allergies: listSchema.optional(),
  desired_cooking_time_minutes: z.number().int().min(5).max(240).nullable().optional(),
  meal_preferences: listSchema.optional(),
  grocery_budget_preference: z.string().trim().max(80).nullable().optional(),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type FoodPreferencesUpdate = z.infer<typeof foodPreferencesUpdateSchema>;
