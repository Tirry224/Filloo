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
grant usage on schema public, extensions, storage to anon, authenticated, service_role;
-- Comme chez Supabase : les droits sur la table existent, c'est le RLS
-- (0004, 0029) qui trie. Sans eux, un test de policy du stockage
-- tomberait sur le droit manquant et passerait pour un refus du RLS.
grant select, insert, update, delete on storage.objects to anon, authenticated;
alter default privileges in schema public
  grant all on tables to anon, authenticated;

-- Realtime : le strict nécessaire pour 0038, recopié de la production le
-- 2026-10-14 (`pg_get_functiondef` de `realtime.send` et
-- `realtime.topic`, colonnes et droits de `realtime.messages`). En
-- production la table est partitionnée par jour sur `inserted_at` et
-- appartient à `supabase_realtime_admin` ; ici une table simple suffit.
create schema if not exists realtime;
create table realtime.messages (
  topic          text not null,
  extension      text not null,
  payload        jsonb,
  event          text,
  private        boolean default false,
  updated_at     timestamp not null default now(),
  inserted_at    timestamp not null default now(),
  id             uuid not null default gen_random_uuid(),
  binary_payload bytea,
  skip_broadcast boolean not null default false,
  primary key (id, inserted_at)
);
alter table realtime.messages enable row level security;
grant usage on schema realtime to anon, authenticated, service_role;
grant select, insert, update on realtime.messages to anon, authenticated, service_role;

create or replace function realtime.topic() returns text
  language sql stable as $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;

-- Même corps qu'en production, y compris l'erreur avalée en avertissement.
-- `security invoker` comme en production : appelée par un client, elle
-- se heurte au RLS de `realtime.messages`.
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
  returns void language plpgsql as $$
declare
  generated_id uuid;
  final_payload jsonb;
begin
  begin
    generated_id := gen_random_uuid();
    if payload ? 'id' then
      final_payload := payload;
    else
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    end if;
    execute format('SET LOCAL realtime.topic TO %L', topic);
    insert into realtime.messages (id, payload, event, topic, private, extension)
    values (generated_id, final_payload, event, topic, private, 'broadcast');
  exception
    when others then
      raise warning 'WarnSendingBroadcastMessage: %', sqlerrm;
  end;
end;
$$;
