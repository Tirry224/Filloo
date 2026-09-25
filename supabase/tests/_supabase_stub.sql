-- Reproduction minimale de l'environnement Supabase, pour tester les
-- migrations en local. Ce fichier ne fait PAS partie du projet.
do $$ begin
  create role anon nologin;         exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin;  exception when duplicate_object then null; end $$;

create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

-- Supabase accorde par défaut les droits sur le schéma public aux rôles
-- anon / authenticated : on reproduit ce comportement pour que les REVOKE
-- des migrations aient un sens.
grant usage on schema public, extensions, storage to anon, authenticated;
-- Comme chez Supabase : les droits sur la table existent, c'est le RLS
-- (0004, 0029) qui trie. Sans eux, un test de policy du stockage
-- tomberait sur le droit manquant et passerait pour un refus du RLS.
grant select, insert, update, delete on storage.objects to anon, authenticated;
alter default privileges in schema public
  grant all on tables to anon, authenticated;
