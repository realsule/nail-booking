-- ============================================================================
-- MREMKO NAILS — SUPABASE SETUP (run ONCE in the Supabase SQL editor)
-- Dashboard → SQL Editor → New query → paste this whole file → Run.
--
-- Creates:
--   • services          (public catalog — anyone reads enabled rows)
--   • gallery_items     (photos — anyone reads published rows)
--   • business_settings (single row, id = 1, JSON settings)
--   • Row Level Security policies + an updated_at trigger
--   • the public "nail-photos" storage bucket + storage policies
--
-- SECURITY MODEL
--   • Anonymous visitors  → may READ enabled services, PUBLISHED photos,
--                           and the settings row. Nothing else.
--   • The owner (any authenticated user on this project) → full CRUD on
--     their own rows and on files inside their own storage folder.
--   • Public sign-up is DISABLED in the dashboard (README step 5), so the
--     only authenticated account is the owner's.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────
-- 1) TABLES
-- ──────────────────────────────────────────────────────────────
create table if not exists public.services (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  price       numeric not null default 0 check (price >= 0),
  duration    text,
  category    text check (category is null or category in
                ('Gel','Acrylic','French Tips','Natural Nails','Nail Art')),
  cover_url   text,
  addons      jsonb not null default '[]'::jsonb
                check (jsonb_typeof(addons) = 'array'),
  featured    boolean not null default false,
  enabled     boolean not null default true,
  sort_order  numeric not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id           uuid primary key default gen_random_uuid(),
  title        text not null default 'Untitled set',
  description  text not null default '',
  category     text not null default 'Nude Nails' check (category in
                 ('Nude Nails','Pink Nails','French Tips','Chrome','Acrylic','Bridal','Nail Art')),
  image_url    text not null default '',
  storage_path text,
  published    boolean not null default false,
  featured     boolean not null default false,
  sort_order   numeric not null default 100,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Single-row settings table (id is always 1). `settings` is a JSON blob so
-- the admin UI can evolve without migrations.
create table if not exists public.business_settings (
  id         integer primary key default 1 check (id = 1),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────
-- 2) updated_at TRIGGER
-- ──────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists services_touch on public.services;
create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();

drop trigger if exists gallery_touch on public.gallery_items;
create trigger gallery_touch before update on public.gallery_items
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.business_settings;
create trigger settings_touch before update on public.business_settings
  for each row execute function public.touch_updated_at();

-- ──────────────────────────────────────────────────────────────
-- 3) ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────
alter table public.services          enable row level security;
alter table public.gallery_items     enable row level security;
alter table public.business_settings enable row level security;

-- ── services ──
drop policy if exists "public read enabled services" on public.services;
create policy "public read enabled services" on public.services
  for select using (enabled = true or auth.uid() is not null);

drop policy if exists "owner insert services" on public.services;
create policy "owner insert services" on public.services
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "owner update services" on public.services;
create policy "owner update services" on public.services
  for update to authenticated using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "owner delete services" on public.services;
create policy "owner delete services" on public.services
  for delete to authenticated using (auth.uid() is not null);

-- ── gallery_items ──
drop policy if exists "public read published photos" on public.gallery_items;
create policy "public read published photos" on public.gallery_items
  for select using (published = true or auth.uid() is not null);

drop policy if exists "owner insert photos" on public.gallery_items;
create policy "owner insert photos" on public.gallery_items
  for insert to authenticated with check (auth.uid() is not null);

drop policy if exists "owner update photos" on public.gallery_items;
create policy "owner update photos" on public.gallery_items
  for update to authenticated using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "owner delete photos" on public.gallery_items;
create policy "owner delete photos" on public.gallery_items
  for delete to authenticated using (auth.uid() is not null);

-- ── business_settings ──
drop policy if exists "public read settings" on public.business_settings;
create policy "public read settings" on public.business_settings
  for select using (true);

drop policy if exists "owner insert settings" on public.business_settings;
create policy "owner insert settings" on public.business_settings
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "owner update settings" on public.business_settings;
create policy "owner update settings" on public.business_settings
  for update to authenticated using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "owner delete settings" on public.business_settings;
create policy "owner delete settings" on public.business_settings
  for delete to authenticated using (owner_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- 4) STORAGE BUCKET + POLICIES
--    Public read (photos show on the site without signed URLs).
--    Writes land in a folder named after the owner's user id.
-- ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('nail-photos', 'nail-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "public read nail photos" on storage.objects;
create policy "public read nail photos" on storage.objects
  for select using (bucket_id = 'nail-photos');

drop policy if exists "owner uploads nail photos" on storage.objects;
create policy "owner uploads nail photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'nail-photos'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owner updates nail photos" on storage.objects;
create policy "owner updates nail photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'nail-photos'
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'nail-photos'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owner deletes nail photos" on storage.objects;
create policy "owner deletes nail photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'nail-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- ──────────────────────────────────────────────────────────────
-- 5) DONE ✅
--    Next: create the owner account (README step 5), paste the URL +
--    anon key into supabase.js, then log in at /admin.html.
-- ──────────────────────────────────────────────────────────────
