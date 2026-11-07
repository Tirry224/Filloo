-- =====================================================================
-- 0057 : les visiteurs uniques se comptent sans savoir qui ils sont
-- =====================================================================
-- Décision du porteur du projet (2026-11-07) : mesurer les visiteurs
-- uniques. Méthode retenue : un cookie propre à Filloo, dont la valeur
-- est un uuid tiré au hasard par navigateur, jamais relié à un profil ni
-- à une adresse IP. Le site le pose et l'envoie avec chaque mesure
-- (`src/lib/analytics.ts`, écriture `service_role`).
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. `analytics_events.visiteur_id` (uuid, facultatif) : null pour les
--    mesures d'avant cette migration et pour celles de l'app mobile.
-- 2. La table reste fermée à `anon` et `authenticated` (0024 : RLS sans
--    policy, aucun droit) ; rien ici ne l'ouvre.
-- 3. `suivi_chiffres` (0034, lue par /admin/statistiques) rend en PLUS :
--    `par_jour[].visiteurs` (visiteurs distincts du jour) et
--    `visiteurs_uniques` (distincts sur la période). Toutes les clés
--    existantes restent identiques (reprise mot pour mot de 0034,
--    constatée identique en production le 2026-11-07).
-- 4. La purge de 0028 (`purger_mesures`, 13 mois) emporte aussi les
--    numéros de visiteur : elle supprime des lignes entières, sur
--    `occurred_at`, sans lire les colonnes.
--
-- CHOIX
-- - Pas de clé étrangère ni de lien vers `profiles` ou `auth.users` : le
--   numéro ne désigne qu'un navigateur, et ne doit pas pouvoir se recoller
--   à un compte par une jointure.
-- - Index partiel `(occurred_at, visiteur_id) where visiteur_id is not
--   null` : « les visiteurs distincts de cette période » se lit dans
--   l'index seul, et les mesures sans numéro (anciennes, app) n'y pèsent
--   rien.
--
-- COMPATIBILITÉ : une colonne nullable et deux clés JSON en plus. L'app
-- installée n'écrit ni ne lit `analytics_events` ; le site actuel ignore
-- les clés qu'il ne connaît pas.

alter table public.analytics_events
  add column visiteur_id uuid;

comment on column public.analytics_events.visiteur_id is
  'Numéro aléatoire d''un navigateur (cookie Filloo), pour compter les visiteurs uniques. Jamais relié à un profil, une connexion ni une IP. Null : mesure d''avant 0057 ou de l''app mobile.';

comment on table public.analytics_events is
  'Compteurs d''usage. Aucune donnée identifiante : ni profil, ni connexion, ni IP ; visiteur_id est un numéro aléatoire de navigateur, non relié à un compte (0057). Écrite par service_role depuis le serveur, lue en SQL au tableau de bord.';

create index analytics_events_visiteurs_idx
  on public.analytics_events (occurred_at, visiteur_id)
  where visiteur_id is not null;

-- Reprise intégrale de 0034 ; seules deux clés s'ajoutent, en fin de
-- leur objet (`visiteurs` dans `par_jour`, `visiteurs_uniques` en fin de
-- réponse). Signature, sécurité et droits inchangés.
create or replace function public.suivi_chiffres(depuis timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    -- Chaque événement de la période, ventilé par rôle.
    'evenements', coalesce((
      select jsonb_object_agg(name, roles)
        from (
          select name,
                 jsonb_build_object(
                   'total',    count(*),
                   'anon',     count(*) filter (where actor_role = 'anon'),
                   'client',   count(*) filter (where actor_role = 'client'),
                   'merchant', count(*) filter (where actor_role = 'merchant')
                 ) as roles
            from public.analytics_events
           where occurred_at >= depuis
           group by name
        ) e
    ), '{}'::jsonb),

    -- Jour par jour (heure de Conakry = UTC), pour voir une tendance.
    'par_jour', coalesce((
      select jsonb_agg(j order by j->>'jour' desc)
        from (
          select jsonb_build_object(
                   'jour',          to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD'),
                   'visites',       count(*) filter (where name = 'visite'),
                   'produits_vus',  count(*) filter (where name = 'produit_vu'),
                   'contacts',      count(*) filter (where name = 'contact_ouvert'),
                   'inscriptions',  count(*) filter (where name = 'inscription'),
                   'messages',      count(*) filter (where name = 'message_envoye'),
                   -- Navigateurs distincts du jour (0057).
                   'visiteurs',     count(distinct visiteur_id)
                 ) as j
            from public.analytics_events
           where occurred_at >= depuis
           group by date_trunc('day', occurred_at)
        ) d
    ), '[]'::jsonb),

    -- Les mots les plus cherchés, et ceux qui ne ramènent rien : la
    -- seconde liste dit quels commerçants aller chercher.
    'recherches', coalesce((
      select jsonb_agg(r order by (r->>'fois')::int desc, r->>'mots')
        from (
          select jsonb_build_object(
                   'mots',  search_query,
                   'fois',  count(*),
                   'vides', count(*) filter (where result_count = 0)
                 ) as r
            from public.analytics_events
           where name = 'recherche'
             and occurred_at >= depuis
             and search_query is not null
           group by search_query
           order by count(*) desc, search_query
           limit 15
        ) s
    ), '[]'::jsonb),
    'recherches_vides', coalesce((
      select jsonb_agg(r order by (r->>'fois')::int desc, r->>'mots')
        from (
          select jsonb_build_object('mots', search_query, 'fois', count(*)) as r
            from public.analytics_events
           where name = 'recherche'
             and occurred_at >= depuis
             and search_query is not null
             and result_count = 0
           group by search_query
           order by count(*) desc, search_query
           limit 15
        ) s
    ), '[]'::jsonb),

    'profils', (
      select jsonb_build_object(
               'clients',        count(*) filter (where role = 'client' and not is_deleted),
               'commercants',    count(*) filter (where role = 'merchant' and not is_deleted),
               'nouveaux_clients',     count(*) filter (where role = 'client' and created_at >= depuis),
               'nouveaux_commercants', count(*) filter (where role = 'merchant' and created_at >= depuis),
               'suspendus',      count(*) filter (where is_suspended and not is_deleted),
               'supprimes',      count(*) filter (where is_deleted)
             )
        from public.profiles
    ),

    'boutiques', (
      select jsonb_build_object(
               'total',      count(*),
               'en_attente', count(*) filter (where status = 'pending'),
               'validees',   count(*) filter (where status = 'approved'),
               'refusees',   count(*) filter (where status = 'rejected'),
               'nouvelles',  count(*) filter (where created_at >= depuis),
               'sans_photo', count(*) filter (where photo_path is null),
               -- Une boutique ouverte qui n'a rien publié : un commerçant
               -- inscrit qu'il faut relancer.
               'sans_produit', count(*) filter (
                 where status = 'approved'
                   and not exists (
                     select 1 from public.products p
                      where p.merchant_id = m.id and p.status in ('active', 'sold')
                   )
               )
             )
        from public.merchants m
    ),

    'produits', (
      select jsonb_build_object(
               'en_ligne',   count(*) filter (where status = 'active'),
               'vendus',     count(*) filter (where status = 'sold'),
               'brouillons', count(*) filter (where status = 'draft'),
               'masques',    count(*) filter (where status = 'hidden'),
               'nouveaux',   count(*) filter (where created_at >= depuis)
             )
        from public.products
    ),

    'messagerie', jsonb_build_object(
      'conversations',          (select count(*) from public.conversations),
      'nouvelles_conversations', (select count(*) from public.conversations where created_at >= depuis),
      'bloquees',               (select count(*) from public.conversations where blocked_by is not null),
      'messages',               (select count(*) from public.messages where created_at >= depuis),
      -- Un message que personne n'a ouvert depuis un jour : un client
      -- qui attend, et qui ne reviendra peut-être pas.
      'non_lus_24h',            (select count(*) from public.messages
                                  where read_at is null and created_at < now() - interval '24 hours'),
      -- Une conversation ouverte dont le vendeur n'a jamais répondu.
      'sans_reponse',           (select count(*) from public.conversations c
                                  where c.created_at < now() - interval '24 hours'
                                    and not exists (
                                      select 1
                                        from public.messages ms
                                        join public.merchants me on me.id = c.merchant_id
                                       where ms.conversation_id = c.id
                                         and ms.sender_id = me.profile_id
                                    ))
    ),

    'signalements', (
      select jsonb_build_object(
               'a_traiter',   count(*) filter (where handled_at is null),
               'nouveaux',    count(*) filter (where created_at >= depuis),
               'produits',    count(*) filter (where handled_at is null and target_type = 'product'),
               'boutiques',   count(*) filter (where handled_at is null and target_type = 'merchant'),
               'conversations', count(*) filter (where handled_at is null and target_type = 'conversation')
             )
        from public.reports
    ),

    'notifications', jsonb_build_object(
      'abonnements_push', (select count(*) from public.push_subscriptions),
      'en_attente',       (select count(*) from public.notifications where sent_at is null and attempts = 0),
      'en_echec',         (select count(*) from public.notifications where sent_at is null and attempts > 0)
    ),

    -- Navigateurs distincts sur la période (0057). Les mesures sans
    -- numéro (anciennes, app mobile) ne comptent pas.
    'visiteurs_uniques', (
      select count(distinct visiteur_id)
        from public.analytics_events
       where occurred_at >= depuis
         and visiteur_id is not null
    )
  );
$$;

revoke all on function public.suivi_chiffres(timestamptz) from public, anon, authenticated;
grant execute on function public.suivi_chiffres(timestamptz) to service_role;
