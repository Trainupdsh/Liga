-- =============================================
-- SUPABASE STORAGE: buckets + RLS policies
-- =============================================
-- Fixes: "new row violates row-level security policy" when uploading
-- a liga logo / club escudo / player photo from the web app.
--
-- The web app uses the public (anon) key, so storage uploads are subject
-- to Row Level Security on storage.objects. By default no policy allows
-- inserts, so every upload is rejected. This migration creates the public
-- buckets the app uses and adds policies that permit read for everyone and
-- insert/update/delete for the anon + authenticated roles.
--
-- Run this in the Supabase SQL editor (or via the CLI). Idempotent.
-- =============================================

-- 1) Create the public buckets the app uploads to
insert into storage.buckets (id, name, public)
values
  ('ligas',      'ligas',      true),
  ('escudos',    'escudos',    true),
  ('torneos',    'torneos',    true),
  ('jugadores',  'jugadores',  true),
  ('arbitros',   'arbitros',   true)
on conflict (id) do update set public = excluded.public;

-- 2) RLS policies on storage.objects, scoped to those buckets.
--    Drop-and-create so the script can be re-run safely.

drop policy if exists "liga_app_public_read"   on storage.objects;
drop policy if exists "liga_app_insert"         on storage.objects;
drop policy if exists "liga_app_update"         on storage.objects;
drop policy if exists "liga_app_delete"         on storage.objects;

-- Public read (buckets are public, but an explicit SELECT policy is needed
-- for signed/listing operations).
create policy "liga_app_public_read"
  on storage.objects for select
  using (bucket_id in ('ligas','escudos','torneos','jugadores','arbitros'));

-- Allow uploads from the app (anon + authenticated).
create policy "liga_app_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id in ('ligas','escudos','torneos','jugadores','arbitros'));

-- Allow overwrites (the app uploads with upsert:true).
create policy "liga_app_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id in ('ligas','escudos','torneos','jugadores','arbitros'))
  with check (bucket_id in ('ligas','escudos','torneos','jugadores','arbitros'));

-- Allow removing replaced images.
create policy "liga_app_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id in ('ligas','escudos','torneos','jugadores','arbitros'));

-- NOTE: these policies are permissive (any anon caller may write to these
-- buckets). For a hardened setup, scope writes to authenticated users only
-- by removing `anon` from the `to` lists above and signing the user in
-- before upload.
