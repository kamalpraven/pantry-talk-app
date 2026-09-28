-- PantryTalk Milestone 2: persistent per-user pantry storage

create extension if not exists "pgcrypto";

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_name text not null,
  display_name text not null,
  quantity numeric,
  unit text,
  confidence numeric,
  source text,
  use_soon_days integer,
  estimated_expiry timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pantry_items_normalized_name_not_blank check (length(btrim(normalized_name)) between 1 and 80),
  constraint pantry_items_display_name_not_blank check (length(btrim(display_name)) between 1 and 80),
  constraint pantry_items_quantity_sane check (quantity is null or (quantity >= 0 and quantity <= 100000)),
  constraint pantry_items_unit_known check (unit is null or unit in ('count', 'g', 'ml', 'portion')),
  constraint pantry_items_confidence_sane check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint pantry_items_source_known check (source is null or source in ('manual', 'voice', 'demo', 'scan', 'cook', 'correction')),
  constraint pantry_items_use_soon_sane check (use_soon_days is null or (use_soon_days >= 0 and use_soon_days <= 365))
);

create unique index if not exists pantry_items_user_normalized_name_key
  on public.pantry_items (user_id, normalized_name);

create index if not exists pantry_items_user_id_idx
  on public.pantry_items (user_id);

drop trigger if exists pantry_items_set_updated_at on public.pantry_items;
create trigger pantry_items_set_updated_at
before update on public.pantry_items
for each row execute function public.set_updated_at();

alter table public.pantry_items enable row level security;

grant select, insert, update, delete on public.pantry_items to authenticated;

-- Authenticated users may access only their own pantry rows. Browser supplied
-- user_id is still checked by RLS and cannot be used to write into another
-- user's pantry.
drop policy if exists "pantry_items_select_own" on public.pantry_items;
create policy "pantry_items_select_own" on public.pantry_items
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "pantry_items_insert_own" on public.pantry_items;
create policy "pantry_items_insert_own" on public.pantry_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "pantry_items_update_own" on public.pantry_items;
create policy "pantry_items_update_own" on public.pantry_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "pantry_items_delete_own" on public.pantry_items;
create policy "pantry_items_delete_own" on public.pantry_items
for delete
to authenticated
using ((select auth.uid()) = user_id);
