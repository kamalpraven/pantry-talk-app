import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-store";
import {
  getAccountProfile,
  updateAccountProfile,
  updateFoodPreferences,
} from "@/lib/profile.functions";

export const Route = createFileRoute("/account")({ component: AccountRoute });

function AccountRoute() {
  return (
    <ProtectedRoute>
      <AccountPage />
    </ProtectedRoute>
  );
}

function toCsv(values: string[] | undefined) {
  return (values ?? []).join(", ");
}

function fromCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function AccountPage() {
  const auth = useAuth();
  const getProfile = useServerFn(getAccountProfile);
  const saveProfile = useServerFn(updateAccountProfile);
  const savePreferences = useServerFn(updateFoodPreferences);
  const [displayName, setDisplayName] = useState("");
  const [householdSize, setHouseholdSize] = useState("1");
  const [defaultServings, setDefaultServings] = useState("2");
  const [preferredUnits, setPreferredUnits] = useState<"us" | "metric">("us");
  const [cookingSkill, setCookingSkill] = useState<"beginner" | "confident" | "advanced" | "">("");
  const [favoriteCuisines, setFavoriteCuisines] = useState("");
  const [dietaryPreferences, setDietaryPreferences] = useState("");
  const [dislikedIngredients, setDislikedIngredients] = useState("");
  const [allergies, setAllergies] = useState("");
  const [mealPreferences, setMealPreferences] = useState("");
  const [desiredTime, setDesiredTime] = useState("30");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ["account-profile", auth.user?.id],
    enabled: Boolean(auth.user),
    queryFn: async () => {
      const accessToken = await auth.getAccessToken();
      if (!accessToken) throw new Error("Not authenticated");
      return getProfile({ data: { accessToken } });
    },
  });

  useEffect(() => {
    const data = query.data;
    if (!data) return;
    setDisplayName(data.profile.display_name ?? "");
    setHouseholdSize(String(data.profile.household_size ?? 1));
    setDefaultServings(String(data.profile.default_servings ?? 2));
    setPreferredUnits(data.profile.preferred_units ?? "us");
    setCookingSkill(data.profile.cooking_skill ?? "");
    setFavoriteCuisines(toCsv(data.foodPreferences.favorite_cuisines));
    setDietaryPreferences(toCsv(data.foodPreferences.dietary_preferences));
    setDislikedIngredients(toCsv(data.foodPreferences.disliked_ingredients));
    setAllergies(toCsv(data.foodPreferences.allergies));
    setMealPreferences(toCsv(data.foodPreferences.meal_preferences));
    setDesiredTime(String(data.foodPreferences.desired_cooking_time_minutes ?? 30));
  }, [query.data]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const accessToken = await auth.getAccessToken();
      if (!accessToken) throw new Error("Not authenticated");
      await saveProfile({
        data: {
          accessToken,
          profile: {
            display_name: displayName || null,
            household_size: Number(householdSize) || null,
            default_servings: Number(defaultServings) || null,
            preferred_units: preferredUnits,
            cooking_skill: cookingSkill || null,
            onboarding_completed: true,
          },
        },
      });
      await savePreferences({
        data: {
          accessToken,
          foodPreferences: {
            favorite_cuisines: fromCsv(favoriteCuisines),
            dietary_preferences: fromCsv(dietaryPreferences),
            disliked_ingredients: fromCsv(dislikedIngredients),
            allergies: fromCsv(allergies),
            meal_preferences: fromCsv(mealPreferences),
            desired_cooking_time_minutes: Number(desiredTime) || null,
          },
        },
      });
      await query.refetch();
      setStatus("Saved your profile.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-28 pb-20 sm:px-8">
      <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Account</p>
      <h1 className="mt-3 text-4xl">Your kitchen profile</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        These preferences are the foundation for personalized cooking. Allergies are only stored
        when you explicitly enter them.
      </p>

      {query.isLoading ? (
        <p className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading profile…
        </p>
      ) : (
        <form
          onSubmit={submit}
          className="mt-8 space-y-6 rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8"
        >
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="householdSize">Household size</Label>
              <Input
                id="householdSize"
                type="number"
                min="1"
                max="20"
                value={householdSize}
                onChange={(event) => setHouseholdSize(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultServings">Default servings</Label>
              <Input
                id="defaultServings"
                type="number"
                min="1"
                max="20"
                value={defaultServings}
                onChange={(event) => setDefaultServings(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredUnits">Preferred units</Label>
              <select
                id="preferredUnits"
                value={preferredUnits}
                onChange={(event) => setPreferredUnits(event.target.value as "us" | "metric")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="us">US</option>
                <option value="metric">Metric</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cookingSkill">Cooking skill</Label>
              <select
                id="cookingSkill"
                value={cookingSkill}
                onChange={(event) => setCookingSkill(event.target.value as typeof cookingSkill)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Not set</option>
                <option value="beginner">Beginner</option>
                <option value="confident">Confident</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="favoriteCuisines">Favorite cuisines</Label>
              <Input
                id="favoriteCuisines"
                value={favoriteCuisines}
                onChange={(event) => setFavoriteCuisines(event.target.value)}
                placeholder="Italian, Thai"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dietaryPreferences">Dietary preferences</Label>
              <Input
                id="dietaryPreferences"
                value={dietaryPreferences}
                onChange={(event) => setDietaryPreferences(event.target.value)}
                placeholder="Vegetarian"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dislikedIngredients">Disliked ingredients</Label>
              <Input
                id="dislikedIngredients"
                value={dislikedIngredients}
                onChange={(event) => setDislikedIngredients(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Input
                id="allergies"
                value={allergies}
                onChange={(event) => setAllergies(event.target.value)}
                placeholder="Only if you want PantryTalk to know"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mealPreferences">Meal preferences</Label>
              <Input
                id="mealPreferences"
                value={mealPreferences}
                onChange={(event) => setMealPreferences(event.target.value)}
                placeholder="Quick dinners, meal prep"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desiredTime">Desired cooking time (minutes)</Label>
              <Input
                id="desiredTime"
                type="number"
                min="5"
                max="240"
                value={desiredTime}
                onChange={(event) => setDesiredTime(event.target.value)}
              />
            </div>
          </section>

          {status && (
            <p className="text-sm font-medium text-primary" role="status">
              {status}
            </p>
          )}
          <Button disabled={saving} className="h-12 rounded-full px-6">
            <Save className="mr-2 size-4" aria-hidden /> {saving ? "Saving…" : "Save profile"}
          </Button>
        </form>
      )}
    </main>
  );
}
