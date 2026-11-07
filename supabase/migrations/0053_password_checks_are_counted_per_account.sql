-- =====================================================================
-- 0053 — Les essais de mot de passe ratés se comptent par compte
-- =====================================================================
-- `refusMotDePasse` (src/lib/supabase/verify.ts) vérifie le mot de passe
-- avant une écriture protégée (0036, 0037). Seule la limite de débit
-- d'Auth, par adresse IP du serveur, la freine aujourd'hui. Le site
-- comptera ici les échecs de chaque compte et refusera au-delà de 5 en
-- 15 minutes.
--
-- Table du SERVEUR seul : RLS activé SANS politique, tout révoqué pour
-- `anon` et `authenticated` (les défauts de Supabase leur accordent
-- tout sur une nouvelle table du schéma public, constaté le 2026-11-07
-- dans `pg_default_acl`). `service_role` y lit, écrit et efface.
--
-- Ménage : une ligne n'a plus d'usage après 15 minutes. La purge tourne
-- DANS la base, par pg_cron, comme `purger_mesures` (0028) : aucun code
-- du site à écrire, ni secret de cron. On garde un jour, pour pouvoir
-- relire un acharnement de la veille.

create table public.essais_mot_de_passe (
  id           bigint generated always as identity primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

comment on table public.essais_mot_de_passe is
  'Mots de passe ratés à la vérification serveur (refusMotDePasse). Écrit et lu par service_role seul ; purgé après un jour (pg_cron).';

-- Sert la question « combien d'échecs pour ce compte depuis 15 min ? »
-- et la clé étrangère (suppression d'un compte).
create index essais_mot_de_passe_compte_date_idx
  on public.essais_mot_de_passe (auth_user_id, created_at);

alter table public.essais_mot_de_passe enable row level security;

revoke all on table public.essais_mot_de_passe from public, anon, authenticated;
revoke all on sequence public.essais_mot_de_passe_id_seq from public, anon, authenticated;
grant select, insert, delete on table public.essais_mot_de_passe to service_role;

-- `security invoker` en clair : le cron tourne en `postgres`, le site en
-- `service_role`, qui ont tous deux le droit d'effacer.
create or replace function public.purger_essais_mot_de_passe()
returns bigint
language sql
security invoker
set search_path = ''
as $$
  with parties as (
    delete from public.essais_mot_de_passe
     where created_at < now() - interval '1 day'
    returning 1
  )
  select count(*) from parties;
$$;

revoke all on function public.purger_essais_mot_de_passe() from public, anon, authenticated;
grant execute on function public.purger_essais_mot_de_passe() to service_role;

-- Conditionnel : le PostgreSQL local des tests n'a pas pg_cron.
-- `cron.schedule` sous le même nom remplace la tâche : rejouable.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purger-essais-mot-de-passe', '33 3 * * *',
                          'select public.purger_essais_mot_de_passe()');
  end if;
end $$;
