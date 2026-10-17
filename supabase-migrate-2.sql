-- ═══════════════════════════════════════════════════════════════════
--  MREMBO NAILS — MIGRATION 2 (safe, additive; preserves existing data)
--  Run this in Supabase → SQL editor AFTER supabase-setup.sql.
--
--  What it does:
--   1. gallery_items gains a `source` column (upload | ai_generated |
--      external) so imported photos can be tracked and removed cleanly.
--   2. Introduces an explicit owner whitelist (app_owners). "Any signed-in
--      user" is NO LONGER treated as the owner — only accounts registered
--      in app_owners may write services/gallery/settings or upload photos.
--      Existing auth users are auto-registered below, so your current
--      owner login keeps working.
--   3. Restricts table & storage write policies to the whitelist.
--
--  How to add ANOTHER owner later (SQL editor, runs as postgres):
--     insert into public.app_owners (user_id)
--     values ('<their auth.users id>'::uuid);
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) gallery image source ─────────────────────────────────────────
alter table public.gallery_items
  add column if not exists source text not null default 'upload';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gallery_items_source_check') then
    alter table public.gallery_items
      add constraint gallery_items_source_check
      check (source in ('upload', 'ai_generated', 'external'));
  end if;
end $$;

-- ── 2) owner whitelist ──────────────────────────────────────────────
create table if not exists public.app_owners (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.app_owners enable row level security;

-- an owner can see their own registration row; nobody else sees rows
drop policy if exists "owner reads own registry row" on public.app_owners;
create policy "owner reads own registry row" on public.app_owners
  for select to authenticated using (auth.uid() = user_id);
-- future registrations happen via the SQL editor only (no role can insert)

-- helper used by every policy below. SECURITY DEFINER so it can read
-- app_owners without tripping RLS recursion. Trust-safe: it only answers
-- "is the caller registered as an owner?".
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_owners where user_id = auth.uid());
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

-- bootstrap: register every EXISTING auth account as owner (normally just
-- your one owner account). New sign-ups after this run are NOT owners.
insert into public.app_owners (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ── 3) tighten table policies ───────────────────────────────────────

-- ── services ──
drop policy if exists "public read enabled services" on public.services;
create policy "public read enabled services" on public.services
  for select using (enabled = true or public.is_owner());

drop policy if exists "owner insert services" on public.services;
create policy "owner insert services" on public.services
  for insert to authenticated with check (public.is_owner());

drop policy if exists "owner update services" on public.services;
create policy "owner update services" on public.services
  for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner delete services" on public.services;
create policy "owner delete services" on public.services
  for delete to authenticated using (public.is_owner());

-- ── gallery_items ──
drop policy if exists "public read published photos" on public.gallery_items;
create policy "public read published photos" on public.gallery_items
  for select using (published = true or public.is_owner());

drop policy if exists "owner insert photos" on public.gallery_items;
create policy "owner insert photos" on public.gallery_items
  for insert to authenticated with check (public.is_owner());

drop policy if exists "owner update photos" on public.gallery_items;
create policy "owner update photos" on public.gallery_items
  for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner delete photos" on public.gallery_items;
create policy "owner delete photos" on public.gallery_items
  for delete to authenticated using (public.is_owner());

-- ── business_settings ──
drop policy if exists "public read settings" on public.business_settings;
create policy "public read settings" on public.business_settings
  for select using (true);

drop policy if exists "owner insert settings" on public.business_settings;
create policy "owner insert settings" on public.business_settings
  for insert to authenticated
  with check (public.is_owner() and owner_id = auth.uid());

drop policy if exists "owner update settings" on public.business_settings;
create policy "owner update settings" on public.business_settings
  for update to authenticated
  using (public.is_owner() and owner_id = auth.uid())
  with check (public.is_owner() and owner_id = auth.uid());

drop policy if exists "owner delete settings" on public.business_settings;
create policy "owner delete settings" on public.business_settings
  for delete to authenticated
  using (public.is_owner() and owner_id = auth.uid());

-- ── 4) tighten storage policies ─────────────────────────────────────
drop policy if exists "public read nail photos" on storage.objects;
create policy "public read nail photos" on storage.objects
  for select using (bucket_id = 'nail-photos');

drop policy if exists "owner uploads nail photos" on storage.objects;
create policy "owner uploads nail photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'nail-photos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.is_owner());

drop policy if exists "owner updates nail photos" on storage.objects;
create policy "owner updates nail photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'nail-photos'
         and (storage.foldername(name))[1] = auth.uid()::text
         and public.is_owner())
  with check (bucket_id = 'nail-photos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.is_owner());

drop policy if exists "owner deletes nail photos" on storage.objects;
create policy "owner deletes nail photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'nail-photos'
         and (storage.foldername(name))[1] = auth.uid()::text
         and public.is_owner());

-- ── 5) done — sanity check (run as owner session) ───────────────────
--   select public.is_owner();        -- should be true after login
--   select count(*) from public.app_owners;
