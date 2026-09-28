-- PantryTalk 2.0 Milestone 1: auth profile foundation
-- Run in Supabase SQL editor or with `supabase db push`.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  household_size integer check (household_size between 1 and 20),
  cooking_skill text check (cooking_skill in ('beginner', 'confident', 'advanced')),
  default_servings integer check (default_servings between 1 and 20),
  preferred_units text not null default 'us' check (preferred_units in ('us', 'metric')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorite_cuisines text[] not null default '{}',
  disliked_ingredients text[] not null default '{}',
  dietary_preferences text[] not null default '{}',
  allergies text[] not null default '{}',
  desired_cooking_time_minutes integer check (desired_cooking_time_minutes between 5 and 240),
  meal_preferences text[] not null default '{}',
  grocery_budget_preference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists food_preferences_set_updated_at on public.food_preferences;
create trigger food_preferences_set_updated_at
before update on public.food_preferences
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', ''), ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', ''), '')
  )
  on conflict (id) do nothing;

  insert into public.food_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.food_preferences enable row level security;

-- Users may access only their own profile/foundation preferences in Milestone 1.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "food_preferences_select_own" on public.food_preferences;
create policy "food_preferences_select_own" on public.food_preferences
for select using (auth.uid() = user_id);

drop policy if exists "food_preferences_insert_own" on public.food_preferences;
create policy "food_preferences_insert_own" on public.food_preferences
for insert with check (auth.uid() = user_id);

drop policy if exists "food_preferences_update_own" on public.food_preferences;
create policy "food_preferences_update_own" on public.food_preferences
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
