-- PantryTalk Milestone 3: favorites, collections, cooking history, and recipe events

create extension if not exists "pgcrypto";

create table if not exists public.recipe_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_collections_name_length check (length(btrim(name)) between 1 and 60),
  constraint recipe_collections_slug_length check (slug is null or length(slug) between 1 and 80)
);

create unique index if not exists recipe_collections_user_name_key
  on public.recipe_collections (user_id, lower(name));

create table if not exists public.favorite_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null,
  recipe_snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint favorite_recipes_recipe_id_length check (length(btrim(recipe_id)) between 1 and 200),
  constraint favorite_recipes_snapshot_size check (recipe_snapshot is null or pg_column_size(recipe_snapshot) <= 8192),
  unique (user_id, recipe_id)
);

create table if not exists public.collection_recipes (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.recipe_collections(id) on delete cascade,
  favorite_recipe_id uuid not null references public.favorite_recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (collection_id, favorite_recipe_id)
);

create table if not exists public.cooking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null,
  recipe_snapshot jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null,
  servings integer,
  actual_minutes integer,
  rating integer,
  would_cook_again boolean,
  notes text,
  finished_photo_url text,
  migration_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cooking_sessions_recipe_id_length check (length(btrim(recipe_id)) between 1 and 200),
  constraint cooking_sessions_status_known check (status in ('active', 'completed', 'abandoned')),
  constraint cooking_sessions_rating_range check (rating is null or rating between 1 and 5),
  constraint cooking_sessions_servings_range check (servings is null or servings between 1 and 30),
  constraint cooking_sessions_duration_range check (actual_minutes is null or actual_minutes between 0 and 1440),
  constraint cooking_sessions_notes_length check (notes is null or length(notes) <= 2000),
  constraint cooking_sessions_snapshot_size check (recipe_snapshot is null or pg_column_size(recipe_snapshot) <= 24576)
);

create unique index if not exists cooking_sessions_user_migration_key
  on public.cooking_sessions (user_id, migration_key)
  where migration_key is not null;

create index if not exists cooking_sessions_user_started_idx
  on public.cooking_sessions (user_id, started_at desc);

create table if not exists public.cooking_substitutions (
  id uuid primary key default gen_random_uuid(),
  cooking_session_id uuid not null references public.cooking_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_ingredient text not null,
  replacement_ingredient text not null,
  created_at timestamptz not null default now(),
  constraint cooking_substitutions_original_length check (length(btrim(original_ingredient)) between 1 and 80),
  constraint cooking_substitutions_replacement_length check (length(btrim(replacement_ingredient)) between 1 and 80)
);

create table if not exists public.recipe_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id text not null,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint recipe_events_recipe_id_length check (length(btrim(recipe_id)) between 1 and 200),
  constraint recipe_events_type_known check (
    event_type in (
      'recipe_saved',
      'recipe_unsaved',
      'recipe_opened',
      'cook_started',
      'cook_completed',
      'cook_abandoned',
      'recipe_rated',
      'recipe_cooked_again'
    )
  ),
  constraint recipe_events_metadata_size check (metadata is null or pg_column_size(metadata) <= 4096)
);

create index if not exists recipe_events_user_recipe_idx
  on public.recipe_events (user_id, recipe_id, created_at desc);

drop trigger if exists recipe_collections_set_updated_at on public.recipe_collections;
create trigger recipe_collections_set_updated_at
before update on public.recipe_collections
for each row execute function public.set_updated_at();

drop trigger if exists cooking_sessions_set_updated_at on public.cooking_sessions;
create trigger cooking_sessions_set_updated_at
before update on public.cooking_sessions
for each row execute function public.set_updated_at();

alter table public.recipe_collections enable row level security;
alter table public.favorite_recipes enable row level security;
alter table public.collection_recipes enable row level security;
alter table public.cooking_sessions enable row level security;
alter table public.cooking_substitutions enable row level security;
alter table public.recipe_events enable row level security;

grant select, insert, update, delete on public.recipe_collections to authenticated;
grant select, insert, update, delete on public.favorite_recipes to authenticated;
grant select, insert, update, delete on public.collection_recipes to authenticated;
grant select, insert, update, delete on public.cooking_sessions to authenticated;
grant select, insert, update, delete on public.cooking_substitutions to authenticated;
grant select, insert on public.recipe_events to authenticated;

drop policy if exists "recipe_collections_select_own" on public.recipe_collections;
create policy "recipe_collections_select_own" on public.recipe_collections for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "recipe_collections_insert_own" on public.recipe_collections;
create policy "recipe_collections_insert_own" on public.recipe_collections for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "recipe_collections_update_own" on public.recipe_collections;
create policy "recipe_collections_update_own" on public.recipe_collections for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "recipe_collections_delete_own" on public.recipe_collections;
create policy "recipe_collections_delete_own" on public.recipe_collections for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "favorite_recipes_select_own" on public.favorite_recipes;
create policy "favorite_recipes_select_own" on public.favorite_recipes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "favorite_recipes_insert_own" on public.favorite_recipes;
create policy "favorite_recipes_insert_own" on public.favorite_recipes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "favorite_recipes_update_own" on public.favorite_recipes;
create policy "favorite_recipes_update_own" on public.favorite_recipes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "favorite_recipes_delete_own" on public.favorite_recipes;
create policy "favorite_recipes_delete_own" on public.favorite_recipes for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "collection_recipes_select_own" on public.collection_recipes;
create policy "collection_recipes_select_own" on public.collection_recipes for select to authenticated using (
  exists (select 1 from public.recipe_collections c where c.id = collection_id and c.user_id = (select auth.uid()))
);
drop policy if exists "collection_recipes_insert_own" on public.collection_recipes;
create policy "collection_recipes_insert_own" on public.collection_recipes for insert to authenticated with check (
  exists (select 1 from public.recipe_collections c where c.id = collection_id and c.user_id = (select auth.uid()))
  and exists (select 1 from public.favorite_recipes f where f.id = favorite_recipe_id and f.user_id = (select auth.uid()))
);
drop policy if exists "collection_recipes_update_own" on public.collection_recipes;
create policy "collection_recipes_update_own" on public.collection_recipes for update to authenticated using (
  exists (select 1 from public.recipe_collections c where c.id = collection_id and c.user_id = (select auth.uid()))
  and exists (select 1 from public.favorite_recipes f where f.id = favorite_recipe_id and f.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.recipe_collections c where c.id = collection_id and c.user_id = (select auth.uid()))
  and exists (select 1 from public.favorite_recipes f where f.id = favorite_recipe_id and f.user_id = (select auth.uid()))
);

drop policy if exists "collection_recipes_delete_own" on public.collection_recipes;
create policy "collection_recipes_delete_own" on public.collection_recipes for delete to authenticated using (
  exists (select 1 from public.recipe_collections c where c.id = collection_id and c.user_id = (select auth.uid()))
);

drop policy if exists "cooking_sessions_select_own" on public.cooking_sessions;
create policy "cooking_sessions_select_own" on public.cooking_sessions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "cooking_sessions_insert_own" on public.cooking_sessions;
create policy "cooking_sessions_insert_own" on public.cooking_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "cooking_sessions_update_own" on public.cooking_sessions;
create policy "cooking_sessions_update_own" on public.cooking_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "cooking_sessions_delete_own" on public.cooking_sessions;
create policy "cooking_sessions_delete_own" on public.cooking_sessions for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "cooking_substitutions_select_own" on public.cooking_substitutions;
create policy "cooking_substitutions_select_own" on public.cooking_substitutions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "cooking_substitutions_insert_own" on public.cooking_substitutions;
create policy "cooking_substitutions_insert_own" on public.cooking_substitutions for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.cooking_sessions s where s.id = cooking_session_id and s.user_id = (select auth.uid()))
);
drop policy if exists "cooking_substitutions_update_own" on public.cooking_substitutions;
create policy "cooking_substitutions_update_own" on public.cooking_substitutions for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.cooking_sessions s where s.id = cooking_session_id and s.user_id = (select auth.uid()))
);
drop policy if exists "cooking_substitutions_delete_own" on public.cooking_substitutions;
create policy "cooking_substitutions_delete_own" on public.cooking_substitutions for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "recipe_events_select_own" on public.recipe_events;
create policy "recipe_events_select_own" on public.recipe_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "recipe_events_insert_own" on public.recipe_events;
create policy "recipe_events_insert_own" on public.recipe_events for insert to authenticated with check ((select auth.uid()) = user_id);
