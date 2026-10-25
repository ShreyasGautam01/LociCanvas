-- LociCanvas Phase 2 foundation.
-- User-owned relational storage for private palaces, notes, and gateway markers.
-- This migration does not enable cloud persistence in the frontend by itself.

create table public.palaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  name text not null
    check (char_length(btrim(name)) between 1 and 80),
  background_url text not null default ''
    check (background_url = '' or background_url ~* '^https://'),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint palaces_id_owner_unique unique (id, owner_id)
);

create table public.markers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  palace_id uuid not null,
  type text not null check (type in ('note', 'gateway')),
  x double precision not null check (x >= 0 and x <= 100),
  y double precision not null check (y >= 0 and y <= 100),
  title text not null
    check (char_length(btrim(title)) between 1 and 120),
  content text not null default '',
  color text not null default '#a5d6a7'
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  destination_palace_id uuid,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint markers_id_owner_unique unique (id, owner_id),
  constraint markers_palace_owner_fk
    foreign key (palace_id, owner_id)
    references public.palaces (id, owner_id)
    on delete cascade,
  constraint markers_destination_owner_fk
    foreign key (destination_palace_id, owner_id)
    references public.palaces (id, owner_id)
    on delete cascade,
  constraint markers_gateway_destination_check
    check (
      (type = 'gateway' and destination_palace_id is not null)
      or
      (type = 'note' and destination_palace_id is null)
    )
);

create index palaces_owner_created_idx
  on public.palaces (owner_id, created_at);

create index markers_owner_palace_idx
  on public.markers (owner_id, palace_id);

create index markers_owner_destination_idx
  on public.markers (owner_id, destination_palace_id)
  where destination_palace_id is not null;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger palaces_set_updated_at
before update on public.palaces
for each row execute function public.set_updated_at();

create trigger markers_set_updated_at
before update on public.markers
for each row execute function public.set_updated_at();

alter table public.palaces enable row level security;
alter table public.markers enable row level security;

revoke all on table public.palaces from public, anon;
revoke all on table public.markers from public, anon;

grant select, insert, update, delete on table public.palaces to authenticated;
grant select, insert, update, delete on table public.markers to authenticated;

create policy palaces_select_own
  on public.palaces for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy palaces_insert_own
  on public.palaces for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy palaces_update_own
  on public.palaces for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy palaces_delete_own
  on public.palaces for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy markers_select_own
  on public.markers for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy markers_insert_own
  on public.markers for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy markers_update_own
  on public.markers for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy markers_delete_own
  on public.markers for delete to authenticated
  using ((select auth.uid()) = owner_id);

comment on table public.palaces is
  'Private memory-palace environments. Access is scoped to the authenticated owner.';
comment on table public.markers is
  'Private notes and gateways positioned within a palace, with owner-consistent references.';
comment on column public.markers.destination_palace_id is
  'Required for gateway markers and null for notes. Composite foreign key enforces same-owner targets.';
