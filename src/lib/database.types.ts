export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          household_size: number | null;
          cooking_skill: "beginner" | "confident" | "advanced" | null;
          default_servings: number | null;
          preferred_units: "us" | "metric";
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          household_size?: number | null;
          cooking_skill?: "beginner" | "confident" | "advanced" | null;
          default_servings?: number | null;
          preferred_units?: "us" | "metric";
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      food_preferences: {
        Row: {
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
        Insert: {
          user_id: string;
          favorite_cuisines?: string[];
          disliked_ingredients?: string[];
          dietary_preferences?: string[];
          allergies?: string[];
          desired_cooking_time_minutes?: number | null;
          meal_preferences?: string[];
          grocery_budget_preference?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["food_preferences"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
