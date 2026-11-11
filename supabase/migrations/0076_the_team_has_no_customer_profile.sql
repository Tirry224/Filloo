-- =====================================================================
-- 0076 : un membre de l'équipe n'a ni profil client ni profil vendeur
-- =====================================================================
-- Demande du porteur du projet (2026-11-11) : « Aucun nom
-- d'administrateur ne doit être dans les profils clients ou vendeurs, ni
-- dans la base, ni sur la page admin. Ça doit se faire automatiquement
-- quand un admin est ajouté. »
--
-- LE PROBLÈME : `handle_new_user` (0002, 0073) crée un profil `client`
-- pour toute inscription par email ; on ne sait qu'APRÈS qu'une personne
-- est de l'équipe (`ajouter_membre`, 0065/0067, ou `requireEquipe` du
-- site en `service_role` pour `OWNER_EMAIL`). Constaté en production le
-- 2026-11-11 : les trois membres ont chacun un profil `client`, listé
-- dans `/admin/gestion/acheteurs` par `equipe_comptes`.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. Entrer dans `equipe` (insert, ou changement d'`auth_user_id` au
--    tableau de bord) SUPPRIME les profils de cette connexion — SAUF si
--    l'un d'eux a une activité (`profil_a_une_activite`) : l'entrée est
--    alors REFUSÉE, « Ce compte a déjà une activité sur Filloo : utilisez
--    un compte séparé pour l'équipe. » (P0001 : `ajouter_membre` rend ce
--    message au site tel quel, `messagePourErreur`). Rien n'est détruit
--    par cascade : un profil sans activité n'emporte que ses
--    `notifications` (file de ses propres avis).
-- 2. Activité = une boutique (`merchants`), une conversation comme client
--    ou comme boutique, un fil qu'il a bloqué (`blocked_by`), un message
--    envoyé, un signalement fait, ou une ligne du journal de l'équipe qui
--    vise ce profil (sa trace de modération resterait sans objet).
-- 3. Aucun profil ne se crée (ni ne se rattache, `update` de
--    `auth_user_id`) pour une connexion de l'équipe : « Ce compte fait
--    partie de l'équipe Filloo : il n'a ni profil client ni profil
--    vendeur. » Cela couvre `handle_new_user` (impossible en pratique : la
--    connexion n'existe pas encore dans `equipe`, clé étrangère),
--    `createLinkedProfileAction` et la complétion Google (0073). Un
--    non-membre n'est pas touché.
-- 4. Les deux règles se croisent sans course : chacune prend le même
--    verrou consultatif de transaction par connexion avant de lire l'autre
--    table ; en READ COMMITTED, l'instruction suivante voit ce que l'autre
--    a validé.
-- 5. Les membres actuels perdent leur profil, avec la MÊME garde : si un
--    seul a une activité, la migration S'ARRÊTE en les nommant, sans rien
--    supprimer (`retirer_les_profils_de_l_equipe`, rejouée par les tests).
-- 6. Défense en profondeur : `equipe_comptes` (page admin) et la partie
--    `profils` de `suivi_chiffres` (statistiques) ignorent toute connexion
--    de l'équipe. Signatures, sécurité, droits inchangés (`create or
--    replace` garde les droits ; ils sont réécrits à l'identique).
--
-- RETRAIT DE L'ÉQUIPE (`retirer_membre`) : la connexion reste SANS profil,
-- non bannie, démarquée (0043). C'est l'état d'une connexion Google pas
-- encore complétée (0073), que le site gère : `/inscription` passe en
-- « Complétez votre compte » (`completeSignupAction`, policy « profiles:
-- je cree mon second compte »), autorisé ici puisqu'elle n'est plus dans
-- `equipe`. Rien à corriger dans la base.
--
-- COMPATIBILITÉ : aucune colonne, table ni signature ne change. Le site
-- de `main` ne lit pas de profil pour un membre (middleware `naQueLAdmin`
-- → `/admin`, `requireEquipe` lit `equipe`). `requireEquipe` insère
-- `OWNER_EMAIL` par `upsert … ignoreDuplicates` : déjà membre en
-- production, aucune ligne insérée, le déclencheur ne part pas.
--
-- PRODUCTION, constaté le 2026-11-11 (lecture) : Tirry et Laouratou n'ont
-- aucune activité ; Alpha Nouhou a, comme client, une conversation
-- (créée le 2026-11-01, avant son entrée dans l'équipe le 2026-11-05) où
-- une boutique lui a écrit un message le 2026-11-09. Telle quelle, la
-- migration s'arrêterait donc sur lui.
-- DÉCISION DU PORTEUR DU PROJET (2026-11-11, option b, transmise par la
-- session principale) : effacer le profil client d'Alpha Nouhou, ce qui
-- emporte par cascade sa conversation avec la boutique « KÉRÉ A ANDA »
-- (`cc8d191f-07a9-49f8-b466-42d2cc628bb5`) et son unique message. Fait
-- par `effacer_profil_decide` (point 2 bis), AVANT le nettoyage gardé,
-- et seulement si l'id désigne toujours le profil client de ce membre et
-- que son activité se limite à cette conversation ; sinon rien n'est
-- effacé et le nettoyage gardé s'arrête comme pour tout autre membre.
-- La garde « activité → refus » reste entière pour tout autre membre et
-- tout futur ajout. Le nettoyage passe AVANT les déclencheurs : arrêtée
-- là, même hors transaction, elle ne laisse que deux fonctions internes
-- (rejouer le fichier entier ensuite : tout y est `create or replace`).


-- ---------------------------------------------------------------------
-- 1. Qu'est-ce qu'une activité
-- ---------------------------------------------------------------------
create or replace function public.profil_a_une_activite(p_profile uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.merchants m where m.profile_id = p_profile)
      or exists (select 1 from public.conversations c
                  where c.client_id = p_profile
                     or c.blocked_by = p_profile
                     or c.merchant_id in (select m.id from public.merchants m where m.profile_id = p_profile))
      or exists (select 1 from public.messages ms where ms.sender_id = p_profile)
      or exists (select 1 from public.reports r where r.reporter_id = p_profile)
      or exists (select 1 from public.journal_equipe j
                  where j.cible_type = 'profil' and j.cible_id = p_profile);
$$;

comment on function public.profil_a_une_activite(uuid) is
  'Interne (0076) : vrai si supprimer ce profil détruirait une donnée réelle (boutique, conversation, blocage, message, signalement, journal).';

revoke all on function public.profil_a_une_activite(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Les membres actuels, AVANT les déclencheurs
-- ---------------------------------------------------------------------
-- Fonction plutôt que bloc anonyme : la règle se prouve dans les tests.
-- En premier : si elle s'arrête, rien d'autre n'est créé, même hors
-- transaction (les deux fonctions internes seules).
create or replace function public.retirer_les_profils_de_l_equipe()
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actifs text;
  v_n      int;
begin
  select string_agg(distinct e.nom, ', ' order by e.nom) into v_actifs
    from public.equipe e
    join public.profiles p on p.auth_user_id = e.auth_user_id
   where public.profil_a_une_activite(p.id);
  if v_actifs is not null then
    raise exception '0076 : rien n''est supprimé, ces membres de l''équipe ont déjà une activité sur Filloo : %. Retirez-les de l''équipe (ils gardent leur compte) et faites-leur un compte séparé, ou décidez à la main.', v_actifs;
  end if;

  delete from public.profiles p
   using public.equipe e
   where e.auth_user_id = p.auth_user_id;
  get diagnostics v_n = row_count;
  raise notice '0076 : % profil(s) de membres de l''équipe supprimé(s).', v_n;
  return v_n;
end;
$$;

revoke all on function public.retirer_les_profils_de_l_equipe() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 2 bis. Le cas tranché par le porteur du projet (2026-11-11)
-- ---------------------------------------------------------------------
-- Efface UN profil nommé, malgré son activité, à trois conditions
-- vérifiées dans la même requête que la suppression :
-- - `p_profile` est un profil CLIENT dont la connexion est dans
--   `equipe` sous le nom `p_nom` ; sinon rien (avis, 0) ;
-- - son activité se limite à la conversation `p_conversation` (comme
--   client), sans signalement qui la vise ; sinon arrêt : la décision ne
--   couvrait pas davantage.
-- Rend le nombre de profils effacés (0 ou 1).
create or replace function public.effacer_profil_decide(p_profile uuid, p_nom text, p_conversation uuid)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_n int;
begin
  if not exists (select 1 from public.profiles p
                   join public.equipe e on e.auth_user_id = p.auth_user_id
                  where p.id = p_profile and p.role = 'client' and e.nom = p_nom) then
    raise notice '0076 : % (%) n''est plus le profil client d''un membre de l''équipe : rien n''est effacé.', p_nom, p_profile;
    return 0;
  end if;

  if exists (select 1 from public.merchants m where m.profile_id = p_profile)
     or exists (select 1 from public.conversations c
                 where (c.client_id = p_profile or c.blocked_by = p_profile)
                   and c.id <> p_conversation)
     or exists (select 1 from public.conversations c
                 where c.id = p_conversation and c.blocked_by is not null)
     or exists (select 1 from public.messages ms
                 where ms.sender_id = p_profile and ms.conversation_id <> p_conversation)
     or exists (select 1 from public.reports r where r.reporter_id = p_profile)
     or exists (select 1 from public.reports r
                 where r.target_type = 'conversation' and r.target_id = p_conversation)
     or exists (select 1 from public.journal_equipe j
                 where j.cible_type = 'profil' and j.cible_id = p_profile) then
    raise exception '0076 : le profil de % a une activité au-delà de la conversation décidée : rien n''est effacé, décision à reprendre.', p_nom;
  end if;

  -- Emporte la conversation, ses messages, les notifications du profil.
  delete from public.profiles p
   using public.equipe e
   where p.id = p_profile and p.role = 'client'
     and e.auth_user_id = p.auth_user_id and e.nom = p_nom;
  get diagnostics v_n = row_count;
  raise notice '0076 : profil de % effacé (décision du 2026-11-11).', p_nom;
  return v_n;
end;
$$;

revoke all on function public.effacer_profil_decide(uuid, text, uuid) from public, anon, authenticated;

select public.effacer_profil_decide('ceaca6f2-66b5-4022-a4ce-4d8ec236fd07', 'Alpha Nouhou',
                                    'cc8d191f-07a9-49f8-b466-42d2cc628bb5');

select public.retirer_les_profils_de_l_equipe();


-- ---------------------------------------------------------------------
-- 3. Entrer dans l'équipe retire le profil, ou est refusé
-- ---------------------------------------------------------------------
create or replace function public.equipe_sans_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Même verrou que `profil_hors_equipe` : voir l'en-tête, point 4.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('filloo:equipe-profil:' || new.auth_user_id::text, 0));

  if exists (select 1 from public.profiles p
              where p.auth_user_id = new.auth_user_id
                and public.profil_a_une_activite(p.id)) then
    raise exception 'Ce compte a déjà une activité sur Filloo : utilisez un compte séparé pour l''équipe.';
  end if;

  delete from public.profiles p where p.auth_user_id = new.auth_user_id;
  return null;
end;
$$;

revoke all on function public.equipe_sans_profil() from public, anon, authenticated;

create or replace trigger equipe_sans_profil
  after insert or update of auth_user_id on public.equipe
  for each row execute function public.equipe_sans_profil();


-- ---------------------------------------------------------------------
-- 4. Aucun profil pour une connexion de l'équipe
-- ---------------------------------------------------------------------
create or replace function public.profil_hors_equipe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('filloo:equipe-profil:' || new.auth_user_id::text, 0));

  if exists (select 1 from public.equipe e where e.auth_user_id = new.auth_user_id) then
    raise exception 'Ce compte fait partie de l''équipe Filloo : il n''a ni profil client ni profil vendeur.';
  end if;
  return new;
end;
$$;

revoke all on function public.profil_hors_equipe() from public, anon, authenticated;

create or replace trigger profil_hors_equipe
  before insert or update of auth_user_id on public.profiles
  for each row execute function public.profil_hors_equipe();


-- ---------------------------------------------------------------------
-- 5. La page admin ne liste pas l'équipe
-- ---------------------------------------------------------------------
-- Reprise de 0067 (constatée identique en production le 2026-11-11, aux
-- fins de ligne près) ; seule la clause `where` du sous-select change.
create or replace function public.equipe_comptes(
  p_recherche text default null,
  p_limite    int  default 50,
  p_role      text default null
)
returns table (
  profile_id              uuid,
  nom                     text,
  role                    text,
  telephone               text,
  email                   text,
  merchant_id             uuid,
  shop_name               text,
  ville                   text,
  is_suspended            boolean,
  is_deleted              boolean,
  suspension_reason       text,
  created_at              timestamptz,
  produits                bigint,
  signalements_en_attente bigint,
  auth_user_id            uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q        text := nullif(btrim(coalesce(p_recherche, '')), '');
  v_role     text := nullif(btrim(coalesce(p_role, '')), '');
  v_n        text;  -- la recherche sans accents ni majuscules
  v_echappe  text;  -- la même, jokers de LIKE neutralisés
  v_chiffres text;  -- ses chiffres seuls, pour un téléphone
  v_limite   int  := least(greatest(coalesce(p_limite, 50), 1), 200);
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if v_role is not null and v_role not in ('client', 'merchant') then
    raise exception 'Filtre de comptes inconnu.';
  end if;

  if v_q is not null then
    v_n := lower(extensions.unaccent(left(v_q, 80)));
    v_echappe := replace(replace(replace(v_n, '\', '\\'), '%', '\%'), '_', '\_');
    -- Seulement pour une recherche qui ressemble à un numéro : sinon
    -- « awa2024@… » trouverait tout téléphone contenant « 2024 ».
    if v_q ~ '^[0-9 +().-]+$' then
      v_chiffres := nullif(regexp_replace(v_q, '\D', '', 'g'), '');
      if char_length(v_chiffres) < 3 then
        v_chiffres := null;
      end if;
    end if;
  end if;

  return query
  select x.profile_id, x.nom, x.role, x.telephone, x.email, x.merchant_id, x.shop_name,
         x.ville, x.is_suspended, x.is_deleted, x.suspension_reason, x.created_at,
         x.produits, x.signalements_en_attente, x.auth_user_id
    from (
      select p.id                                              as profile_id,
             p.full_name                                       as nom,
             p.role::text                                      as role,
             p.phone                                           as telephone,
             u.email::text                                     as email,
             m.id                                              as merchant_id,
             m.shop_name                                       as shop_name,
             ci.name                                           as ville,
             p.is_suspended                                    as is_suspended,
             p.is_deleted                                      as is_deleted,
             p.suspension_reason                               as suspension_reason,
             p.created_at                                      as created_at,
             (select count(*) from public.products pr where pr.merchant_id = m.id) as produits,
             (select count(*) from public.reports r
               where r.handled_at is null
                 and (   (r.target_type = 'merchant' and r.target_id = m.id)
                      or (r.target_type = 'product' and r.target_id in
                            (select pr.id from public.products pr where pr.merchant_id = m.id))
                      or (r.target_type = 'conversation' and r.target_id in
                            (select c.id from public.conversations c
                              where c.client_id = p.id or c.merchant_id = m.id)))
             )                                                 as signalements_en_attente,
             p.auth_user_id                                    as auth_user_id,
             lower(extensions.unaccent(coalesce(p.full_name, ''))) as n_nom,
             lower(extensions.unaccent(coalesce(m.shop_name, ''))) as n_boutique,
             lower(coalesce(u.email::text, ''))                as n_email,
             regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') as n_tel
        from public.profiles p
        left join auth.users u      on u.id = p.auth_user_id
        left join public.merchants m on m.profile_id = p.id
        left join public.cities ci  on ci.id = coalesce(m.city_id, p.city_id)
       where (v_role is null or p.role::text = v_role)
         -- 0076 : une connexion de l'équipe n'est pas un compte du site.
         and not exists (select 1 from public.equipe e where e.auth_user_id = p.auth_user_id)
    ) x
   cross join lateral (
     select case
              when v_q is null then 0
              when x.n_nom = v_n or x.n_boutique = v_n or x.n_email = v_n
                   or (v_chiffres is not null and x.n_tel = v_chiffres) then 0
              when x.n_nom like v_echappe || '%' or x.n_boutique like v_echappe || '%'
                   or x.n_email like v_echappe || '%'
                   or (v_chiffres is not null and x.n_tel like v_chiffres || '%') then 1
              else 2
            end as rang
   ) s
   where v_q is null
      or x.n_nom      like '%' || v_echappe || '%'
      or x.n_boutique like '%' || v_echappe || '%'
      or x.n_email    like '%' || v_echappe || '%'
      or lower(coalesce(x.telephone, '')) like '%' || v_echappe || '%'
      or (v_chiffres is not null and x.n_tel like '%' || v_chiffres || '%')
   order by x.is_deleted, s.rang, x.created_at desc, x.profile_id
   limit v_limite;
end;
$$;

comment on function public.equipe_comptes(text, int, text) is
  'Équipe seule (0063, 0067, 0076) : les comptes, filtre client / merchant, recherche sans accents ; supprimés en dernier ; jamais une connexion de l''équipe.';

revoke execute on function public.equipe_comptes(text, int, text) from public, anon;
grant execute on function public.equipe_comptes(text, int, text) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Les statistiques ne comptent pas l'équipe
-- ---------------------------------------------------------------------
-- Reprise intégrale de 0057 (même logique qu'en production le 2026-11-11 ;
-- la production n'a pas les commentaires) ; seule la partie `profils`
-- change. Signature, sécurité et droits inchangés.
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

    -- 0076 : une connexion de l'équipe ne compte ni comme client ni comme
    -- commerçant.
    'profils', (
      select jsonb_build_object(
               'clients',        count(*) filter (where pf.role = 'client' and not pf.is_deleted),
               'commercants',    count(*) filter (where pf.role = 'merchant' and not pf.is_deleted),
               'nouveaux_clients',     count(*) filter (where pf.role = 'client' and pf.created_at >= depuis),
               'nouveaux_commercants', count(*) filter (where pf.role = 'merchant' and pf.created_at >= depuis),
               'suspendus',      count(*) filter (where pf.is_suspended and not pf.is_deleted),
               'supprimes',      count(*) filter (where pf.is_deleted)
             )
        from public.profiles pf
       where not exists (select 1 from public.equipe eq where eq.auth_user_id = pf.auth_user_id)
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
