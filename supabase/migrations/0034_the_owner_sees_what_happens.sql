-- =====================================================================
-- 0034 — Le porteur du projet voit ce qui se passe
-- =====================================================================
-- Le test utilisateurs du 2026-10-06 a montré que les chiffres existaient
-- (0024) mais que personne ne pouvait les lire sans écrire du SQL. Cette
-- fonction rassemble en UN appel tout ce que la page `/suivi` affiche.
--
-- Pourquoi une fonction plutôt que des requêtes depuis l'application :
-- l'API REST plafonne une réponse à 1000 lignes. Compter des événements
-- en les rapatriant donnerait des chiffres FAUX dès le premier jour
-- chargé, sans rien signaler. Agréger dans la base, c'est compter juste.
--
-- `security invoker` et réservée à `service_role` : elle ne lit rien que
-- son appelant ne pourrait lire lui-même, et ni `anon` ni
-- `authenticated` ne peuvent l'appeler en RPC. La garde « qui a le droit
-- de voir ces chiffres » est dans `src/app/suivi/page.tsx`, avant tout
-- appel ; ici, seule la clé serveur passe.
--
-- Aucun contenu de message, aucun nom, aucun numéro : des nombres, et les
-- mots tapés en recherche que 0024 conserve déjà.

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
                   'messages',      count(*) filter (where name = 'message_envoye')
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
    )
  );
$$;

revoke all on function public.suivi_chiffres(timestamptz) from public, anon, authenticated;
grant execute on function public.suivi_chiffres(timestamptz) to service_role;
