-- =====================================================================
-- 0028 — Le ménage : photos orphelines, mesures de plus de 13 mois
-- =====================================================================
-- Deux choses grossissaient sans que rien ne les arrête (constaté le
-- 2026-09-25) :
--
-- 1. LES PHOTOS ORPHELINES. `PhotoPicker` envoie une photo dès qu'on la
--    choisit, AVANT que le produit existe. Un formulaire abandonné laisse
--    donc un fichier que rien ne référence : une photo sur quatre en
--    production ce jour-là. Elle reste lisible par son adresse publique.
--
--    Supabase INTERDIT d'effacer un fichier par SQL (trigger
--    `storage.protect_delete`) : la ligne partirait, le fichier resterait.
--    Cette fonction ne fait donc que DÉSIGNER les orphelines ; c'est
--    `/api/quotidien` qui les efface par l'API de stockage.
--
--    Délai de 24 heures : un formulaire en cours de saisie porte des
--    photos pas encore enregistrées, qu'il ne faut pas lui retirer.
--
-- 2. LES MESURES (`analytics_events`, 0024). Anonymes, mais sans fin.
--    Treize mois, décision du 2026-09-25 : de quoi comparer un mois à
--    celui de l'année d'avant. Messages, signalements et comptes
--    anonymisés ne sont PAS concernés : les effacer demande un avis
--    juridique (loi guinéenne L/2016/037) qui n'a pas été pris.

create or replace function public.photos_orphelines(
  age interval default interval '24 hours',
  limite int default 1000
)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'product-images'
     and o.created_at < now() - age
     and not exists (
       select 1 from public.product_images i where i.storage_path = o.name
     )
   order by o.created_at
   limit limite;
$$;

-- Réservée au serveur : elle lit tout le stockage, RLS compris.
revoke all on function public.photos_orphelines(interval, int) from public, anon, authenticated;
grant execute on function public.photos_orphelines(interval, int) to service_role;


create or replace function public.purger_mesures()
returns bigint
language sql
security definer
set search_path = ''
as $$
  with parties as (
    delete from public.analytics_events
     where occurred_at < now() - interval '13 months'
    returning 1
  )
  select count(*) from parties;
$$;

revoke all on function public.purger_mesures() from public, anon, authenticated;
grant execute on function public.purger_mesures() to service_role;

-- La purge tourne DANS la base (pg_cron) et non depuis Vercel : elle ne
-- dépend ainsi ni de CRON_SECRET ni de la clé service_role, les deux
-- pannes connues du cron Vercel. 3 h 23 UTC, hors de l'heure pile.
--
-- Conditionnel parce que le PostgreSQL local des tests de sécurité n'a
-- pas pg_cron ; en production, l'extension est installée.
-- `cron.schedule` sous le même nom REMPLACE la tâche : rejouable.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purger-mesures', '23 3 * * *', 'select public.purger_mesures()');
  end if;
end $$;
