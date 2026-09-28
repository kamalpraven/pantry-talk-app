export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      pantry_items: {
        Row: {
          id: string;
          user_id: string;
          normalized_name: string;
          display_name: string;
          quantity: number | null;
          unit: string | null;
          confidence: number | null;
          source: string | null;
          use_soon_days: number | null;
          estimated_expiry: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          normalized_name: string;
          display_name: string;
          quantity?: number | null;
          unit?: string | null;
          confidence?: number | null;
          source?: string | null;
          use_soon_days?: number | null;
          estimated_expiry?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pantry_items"]["Insert"]>;
      };
      recipe_collections: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string | null;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          slug?: string | null;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recipe_collections"]["Insert"]>;
      };
      favorite_recipes: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          recipe_snapshot: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id: string;
          recipe_snapshot?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["favorite_recipes"]["Insert"]>;
      };
      collection_recipes: {
        Row: {
          id: string;
          collection_id: string;
          favorite_recipe_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          favorite_recipe_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["collection_recipes"]["Insert"]>;
      };
      cooking_sessions: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          recipe_snapshot: Json | null;
          started_at: string;
          completed_at: string | null;
          status: "active" | "completed" | "abandoned";
          servings: number | null;
          actual_minutes: number | null;
          rating: number | null;
          would_cook_again: boolean | null;
          notes: string | null;
          finished_photo_url: string | null;
          migration_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id: string;
          recipe_snapshot?: Json | null;
          started_at?: string;
          completed_at?: string | null;
          status: "active" | "completed" | "abandoned";
          servings?: number | null;
          actual_minutes?: number | null;
          rating?: number | null;
          would_cook_again?: boolean | null;
          notes?: string | null;
          finished_photo_url?: string | null;
          migration_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cooking_sessions"]["Insert"]>;
      };
      cooking_substitutions: {
        Row: {
          id: string;
          cooking_session_id: string;
          user_id: string;
          original_ingredient: string;
          replacement_ingredient: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          cooking_session_id: string;
          user_id: string;
          original_ingredient: string;
          replacement_ingredient: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cooking_substitutions"]["Insert"]>;
      };
      recipe_events: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          event_type:
            | "recipe_saved"
            | "recipe_unsaved"
            | "recipe_opened"
            | "cook_started"
            | "cook_completed"
            | "cook_abandoned"
            | "recipe_rated"
            | "recipe_cooked_again";
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id: string;
          event_type:
            | "recipe_saved"
            | "recipe_unsaved"
            | "recipe_opened"
            | "cook_started"
            | "cook_completed"
            | "cook_abandoned"
            | "recipe_rated"
            | "recipe_cooked_again";
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recipe_events"]["Insert"]>;
      };
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
