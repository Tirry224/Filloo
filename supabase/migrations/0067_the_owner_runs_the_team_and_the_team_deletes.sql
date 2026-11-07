-- =====================================================================
-- 0067 : le propriétaire tient l'équipe ; l'équipe voit une fiche
--        complète, supprime un produit, signe une suppression de compte,
--        et l'ordre des catégories et des villes se refait seul
-- =====================================================================
-- Décisions du porteur du projet du 2026-11-07 :
-- - seul le PROPRIÉTAIRE de Filloo ajoute ou retire un membre de l'équipe
--   (0065 l'ouvrait à tout membre) ;
-- - acheteurs et vendeurs ont chacun leur liste ;
-- - la fiche d'un compte dit tout ce qu'on sait, boutique et produits
--   compris ;
-- - l'équipe supprime un produit, et supprime un compte (anonymisation
--   faite par le site, signée ici) ;
-- - retirer une catégorie ou une ville ne laisse pas de trou dans l'ordre.
--
-- CE QUE LA BASE GARANTIT APRÈS
-- 1. `equipe.proprietaire` : au plus UN propriétaire (index unique
--    partiel). La migration le pose sur le membre le plus ancien
--    (`created_at` minimal ; en production : Tirry, inscrit le 2026-11-05
--    à 21 h 15, constaté le 2026-11-07, aucune égalité). Si deux membres
--    partagent ce plus petit `created_at`, la migration s'arrête
--    (`raise exception`) au lieu de choisir au hasard. Équipe vide (base
--    de test) : personne n'est propriétaire.
-- 2. Aucun écran ne change `proprietaire` : `equipe` n'a plus aucun droit
--    d'écriture pour `anon` / `authenticated` (0065, table entière, donc
--    toute colonne ajoutée ensuite) et aucune fonction ici ne l'écrit.
--    Le changer = tableau de bord Supabase.
-- 3. `je_suis_proprietaire()` (modèle de `je_suis_de_l_equipe()`, 0042) :
--    bornée à `auth.uid()`, lit `equipe`, pas le jeton.
-- 4. `ajouter_membre` / `retirer_membre` exigent d'être de l'équipe
--    (message inchangé pour un non-membre), PUIS d'être propriétaire
--    (« Réservé au propriétaire de Filloo. »), revérifié après le verrou
--    pour le retrait. Le propriétaire ne se retire pas (on ne se retire
--    pas soi-même, 0065 ; et une garde explicite sur la cible).
-- 5. `equipe_membres()` rend en plus `proprietaire`.
-- 6. `equipe_comptes(p_recherche, p_limite, p_role)` : `p_role` vaut
--    'client', 'merchant' ou null (tous) ; toute autre valeur est refusée
--    (« Filtre de comptes inconnu. »). Colonnes et tri de 0063, plus
--    `auth_user_id` en DERNIER (la connexion : l'équipe écrit en premier à
--    quelqu'un par `fil_equipe.fil_de`, que le RLS de 0042 autorise déjà ;
--    le site lit les colonnes par nom). L'appel à deux paramètres du site en production continue de
--    marcher (troisième paramètre à défaut).
-- 7. `equipe_compte(p_profile)` : équipe seule ; une ligne (zéro si le
--    profil n'existe pas) avec l'identité, l'email, sa confirmation, la
--    dernière connexion (`auth.users`), la boutique, les compteurs
--    produits / conversations / signalements en attente (définition de
--    0063) et `est_de_l_equipe` (la connexion est dans `equipe`).
-- 8. `equipe_produits_boutique(p_merchant)` : équipe seule ; TOUS les
--    produits de la boutique, tous statuts, avec le chemin de la photo de
--    plus petite position (ou null). Les plus récents d'abord.
-- 9. `supprimer_produit_equipe(p_produit, p_motif)` : équipe seule, motif
--    de 3 à 500 caractères, produit verrouillé, journal
--    `supprimer_produit` (cible 'produit') écrit AVANT le `delete`, dans
--    la même transaction ; rend le `merchant_id` (le site efface ensuite
--    le dossier `{merchant_id}/{product_id}/` du stockage). Le motif du
--    journal garde le titre et la boutique en clair : le produit, lui,
--    n'existe plus. La suppression emporte (constaté en production le
--    2026-11-07, `pg_constraint`, `pg_trigger`) :
--    - `product_images` : lignes supprimées (cascade) ; les FICHIERS ne
--      partent que par le site ;
--    - `campagnes` du produit : supprimées (cascade, 0047) ;
--    - `messages.product_id` : passe à null, les messages restent ;
--    - `reports` qui visent le produit (`target_id`, sans clé étrangère) :
--      restent ; un signalement en attente reste dans
--      `signalements_a_traiter` (jointures externes, titre null) et se
--      classe « sans suite » ;
--    - `analytics_events.product_id` (sans clé étrangère) : reste ;
--    - le déclencheur `product_images_keep_active_publishable` passe sur
--      un produit déjà parti : il ne fait rien.
-- 10. `journaliser_suppression_compte(p_profile, p_motif)` : équipe seule,
--    motif de 3 à 500 caractères, REFUSÉ si le profil n'est pas
--    `is_deleted` : le journal n'est écrit qu'après une suppression
--    réelle (faite par le site, `service_role`, `supprimerProfil` :
--    anonymisation, jamais de `delete`). Rappelée pour un profil déjà
--    journalisé, elle ne fait rien. Le site vérifie AVANT, par
--    `equipe_compte`, que l'appelant est de l'équipe et que la cible
--    n'est pas une connexion de l'équipe.
-- 11. `retirer_categorie` / `retirer_ville` : après un retrait réussi,
--    les positions restantes sont renumérotées 1..n (ordre actuel :
--    position, nom, id), sous un verrou de la liste (le même que
--    `fixer_*`, 0066). Seul le retrait est journalisé. La migration fait
--    cette renumérotation une fois (en production le 2026-11-07 :
--    catégories 2..9 → 1..8, villes 1, 2, 4, 6..9 → 1..7 ; même ordre).
--
-- CHOIX
-- - `rejection_reason` (fiche) vaut toujours null : la colonne a été
--   retirée de `merchants` par 0033 (plus de refus de boutique, constaté
--   en production le 2026-11-07). Gardée dans le retour parce que le site
--   l'attend ; elle ne lit rien.
-- - Ordre des gardes : équipe, puis propriétaire. Un non-membre reçoit
--   toujours « Réservé à l'équipe Filloo. » (0065) : il n'apprend rien.
-- - `journal_equipe_cible_type_check` ne change pas : 'produit' et
--   'profil' y sont déjà (0066).
-- - Le propriétaire qui disparaîtrait (supprimé au tableau de bord) ne
--   laisse personne pour ajouter ou retirer : choix voulu, la reprise se
--   fait au tableau de bord.
--
-- ATTENTION à la publication de la branche `monetisation` : ses
-- réécritures de `journal_equipe_action_check` (0058-0060) doivent garder
-- les valeurs de 0064-0067 (dont `supprimer_produit`, `supprimer_compte`),
-- sinon le `add constraint` échoue sur les lignes existantes.
--
-- COMPATIBILITÉ AVEC L'APP INSTALLÉE : l'app (`tirry224/filloo-mobile`)
-- ne lit ni `equipe` ni aucune de ces fonctions (constaté le 2026-11-07,
-- grep de `src/`). Elle lit `categories(id, name)` et `cities(id, name)`
-- triées par `position` : la renumérotation ne change que les valeurs de
-- position, pas l'ordre (deux positions égales, ordre indéfini pour
-- l'app, sont départagées par le nom). Elle supprime déjà ses propres
-- produits : un produit supprimé par l'équipe disparaît de ses listes
-- comme celui-là.


-- ---------------------------------------------------------------------
-- 1. Le propriétaire
-- ---------------------------------------------------------------------
alter table public.equipe
  add column proprietaire boolean not null default false;

comment on column public.equipe.proprietaire is
  'Le propriétaire de Filloo (un seul, 0067) : seul à ajouter ou retirer un membre. Changé au tableau de bord seulement.';

create unique index equipe_un_seul_proprietaire on public.equipe (proprietaire) where proprietaire;

-- Fonction plutôt que bloc anonyme : la règle se prouve dans les tests.
-- Ne fait rien si un propriétaire existe déjà.
create or replace function public.poser_premier_proprietaire()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_premier timestamptz;
  v_egaux   int;
begin
  if exists (select 1 from public.equipe e where e.proprietaire) then
    return;
  end if;
  select min(e.created_at) into v_premier from public.equipe e;
  if v_premier is null then
    raise notice '0067 : équipe vide, aucun propriétaire posé.';
    return;
  end if;
  select count(*) into v_egaux from public.equipe e where e.created_at = v_premier;
  if v_egaux > 1 then
    raise exception '0067 : % membres partagent la plus ancienne date d''entrée : propriétaire ambigu, à désigner à la main.', v_egaux;
  end if;
  update public.equipe e set proprietaire = true where e.created_at = v_premier;
end;
$$;

revoke execute on function public.poser_premier_proprietaire() from public, anon, authenticated;

select public.poser_premier_proprietaire();

create or replace function public.je_suis_proprietaire()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.equipe
                  where auth_user_id = (select auth.uid()) and proprietaire);
$$;

comment on function public.je_suis_proprietaire() is
  'Vrai si la connexion est le propriétaire de Filloo (equipe.proprietaire, 0067).';

revoke execute on function public.je_suis_proprietaire() from public, anon;
grant execute on function public.je_suis_proprietaire() to authenticated;


-- ---------------------------------------------------------------------
-- 2. Le journal connaît les suppressions
-- ---------------------------------------------------------------------
-- Liste de 0066 (constatée en production le 2026-11-07), deux valeurs
-- ajoutées. Les cibles ('produit', 'profil') existent déjà.
alter table public.journal_equipe drop constraint journal_equipe_action_check;
alter table public.journal_equipe add constraint journal_equipe_action_check
  check (action in ('suspendre', 'reactiver', 'masquer_produit', 'classer_signalement',
                    'valider_campagne', 'refuser_campagne', 'interrompre_campagne',
                    'demasquer_produit', 'ajouter_membre', 'retirer_membre',
                    'fixer_categorie', 'retirer_categorie', 'fixer_ville', 'retirer_ville',
                    'supprimer_produit', 'supprimer_compte'));


-- ---------------------------------------------------------------------
-- 3. Les membres : seul le propriétaire ajoute ou retire
-- ---------------------------------------------------------------------
drop function public.equipe_membres();

create function public.equipe_membres()
returns table (auth_user_id uuid, nom text, email text, created_at timestamptz, moi boolean, proprietaire boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  return query
  select e.auth_user_id, e.nom, u.email::text, e.created_at,
         e.auth_user_id = (select auth.uid()), e.proprietaire
    from public.equipe e
    left join auth.users u on u.id = e.auth_user_id
   order by e.created_at, e.nom, e.auth_user_id;
end;
$$;

comment on function public.equipe_membres() is
  'Équipe seule (0065, 0067) : les membres, leur email, « moi » et le propriétaire.';

revoke execute on function public.equipe_membres() from public, anon;
grant execute on function public.equipe_membres() to authenticated;


create or replace function public.ajouter_membre(p_email text, p_nom text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nom   text := btrim(coalesce(p_nom, ''));
  v_ids   uuid[];
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if not public.je_suis_proprietaire() then
    raise exception 'Réservé au propriétaire de Filloo.';
  end if;
  if char_length(v_nom) not between 1 and 60 then
    raise exception 'Le prénom affiché aux collègues fait de 1 à 60 caractères.';
  end if;
  if v_email = '' then
    raise exception 'Aucun compte confirmé avec cette adresse : la personne doit d''abord s''inscrire sur Filloo.';
  end if;

  select array_agg(u.id) into v_ids
    from auth.users u
   where lower(u.email) = v_email
     and u.email_confirmed_at is not null
     and u.deleted_at is null
     and coalesce(u.is_anonymous, false) = false;
  if v_ids is null then
    raise exception 'Aucun compte confirmé avec cette adresse : la personne doit d''abord s''inscrire sur Filloo.';
  end if;
  if cardinality(v_ids) > 1 then
    raise exception 'Plusieurs comptes portent cette adresse : ajoutez ce membre depuis le tableau de bord Supabase.';
  end if;

  -- Verrou de toute l'équipe : même ordre que `retirer_membre`.
  perform 1 from public.equipe e for update;
  if exists (select 1 from public.equipe e where e.auth_user_id = v_ids[1]) then
    raise exception 'Cette personne fait déjà partie de l''équipe.';
  end if;

  -- `proprietaire` prend son défaut (false). Le déclencheur de 0043 pose
  -- `app_metadata.equipe = true`.
  insert into public.equipe (auth_user_id, nom) values (v_ids[1], v_nom);

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'ajouter_membre', 'membre', v_ids[1], left(v_nom || ' <' || v_email || '>', 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

comment on function public.ajouter_membre(text, text) is
  'Propriétaire seul (0065, 0067) : fait entrer une connexion existante et confirmée ; la marque app_metadata suit (0043).';

revoke execute on function public.ajouter_membre(text, text) from public, anon;
grant execute on function public.ajouter_membre(text, text) to authenticated;


create or replace function public.retirer_membre(p_auth uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom          text;
  v_email        text;
  v_proprietaire boolean;
  v_restes       int;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if not public.je_suis_proprietaire() then
    raise exception 'Réservé au propriétaire de Filloo.';
  end if;
  if p_auth = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas vous retirer vous-même de l''équipe.';
  end if;

  perform 1 from public.equipe e for update;

  -- Relu APRÈS le verrou : le tableau de bord a pu changer l'équipe.
  if not public.je_suis_proprietaire() then
    raise exception 'Réservé au propriétaire de Filloo.';
  end if;
  select e.nom, u.email::text, e.proprietaire into v_nom, v_email, v_proprietaire
    from public.equipe e left join auth.users u on u.id = e.auth_user_id
   where e.auth_user_id = p_auth;
  if not found then
    raise exception 'Ce compte ne fait pas partie de l''équipe.';
  end if;
  if v_proprietaire then
    raise exception 'Le propriétaire de Filloo ne se retire pas de l''équipe.';
  end if;
  select count(*) into v_restes from public.equipe e;
  if v_restes <= 1 then
    raise exception 'Impossible de retirer le dernier membre de l''équipe.';
  end if;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'retirer_membre', 'membre', p_auth,
         left(v_nom || coalesce(' <' || v_email || '>', ''), 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());

  -- Le déclencheur de 0043 retire la marque ; les références vers
  -- `equipe` passent à null, les messages et annonces restent.
  delete from public.equipe e where e.auth_user_id = p_auth;
end;
$$;

comment on function public.retirer_membre(uuid) is
  'Propriétaire seul (0065, 0067) : fait sortir un collègue (ni soi-même, ni le propriétaire, ni le dernier).';

revoke execute on function public.retirer_membre(uuid) from public, anon;
grant execute on function public.retirer_membre(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 4. Acheteurs et vendeurs : deux listes
-- ---------------------------------------------------------------------
-- Drop puis create : garder l'ancienne à côté ferait deux fonctions du
-- même nom, que PostgREST ne départage pas pour un appel à deux clés.
drop function public.equipe_comptes(text, int);

create function public.equipe_comptes(
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
       where v_role is null or p.role::text = v_role
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
  'Équipe seule (0063, 0067) : les comptes, filtre client / merchant, recherche sans accents ; supprimés en dernier.';

revoke execute on function public.equipe_comptes(text, int, text) from public, anon;
grant execute on function public.equipe_comptes(text, int, text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. La fiche d'un compte
-- ---------------------------------------------------------------------
create or replace function public.equipe_compte(p_profile uuid)
returns table (
  profile_id              uuid,
  auth_user_id            uuid,
  role                    text,
  nom                     text,
  telephone               text,
  email                   text,
  email_confirme_le       timestamptz,
  derniere_connexion      timestamptz,
  ville                   text,
  created_at              timestamptz,
  is_suspended            boolean,
  suspension_reason       text,
  is_deleted              boolean,
  deleted_at              timestamptz,
  merchant_id             uuid,
  shop_name               text,
  description             text,
  whatsapp_phone          text,
  address_hint            text,
  photo_path              text,
  statut_boutique         text,
  approved_at             timestamptz,
  rejection_reason        text,
  produits                bigint,
  conversations           bigint,
  signalements_en_attente bigint,
  est_de_l_equipe         boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  return query
  select p.id,
         p.auth_user_id,
         p.role::text,
         p.full_name,
         p.phone,
         u.email::text,
         u.email_confirmed_at,
         u.last_sign_in_at,
         ci.name,
         p.created_at,
         p.is_suspended,
         p.suspension_reason,
         p.is_deleted,
         p.deleted_at,
         m.id,
         m.shop_name,
         m.description,
         m.whatsapp_phone,
         m.address_hint,
         m.photo_path,
         m.status::text,
         m.approved_at,
         null::text,  -- colonne retirée par 0033 : plus de refus de boutique
         (select count(*) from public.products pr where pr.merchant_id = m.id),
         (select count(*) from public.conversations c
           where c.client_id = p.id or c.merchant_id = m.id),
         (select count(*) from public.reports r
           where r.handled_at is null
             and (   (r.target_type = 'merchant' and r.target_id = m.id)
                  or (r.target_type = 'product' and r.target_id in
                        (select pr.id from public.products pr where pr.merchant_id = m.id))
                  or (r.target_type = 'conversation' and r.target_id in
                        (select c.id from public.conversations c
                          where c.client_id = p.id or c.merchant_id = m.id)))),
         exists (select 1 from public.equipe e where e.auth_user_id = p.auth_user_id)
    from public.profiles p
    left join auth.users u       on u.id = p.auth_user_id
    left join public.merchants m on m.profile_id = p.id
    left join public.cities ci   on ci.id = coalesce(m.city_id, p.city_id)
   where p.id = p_profile;
end;
$$;

comment on function public.equipe_compte(uuid) is
  'Équipe seule (0067) : la fiche complète d''un profil (connexion, boutique, compteurs, est_de_l_equipe).';

revoke execute on function public.equipe_compte(uuid) from public, anon;
grant execute on function public.equipe_compte(uuid) to authenticated;


create or replace function public.equipe_produits_boutique(p_merchant uuid)
returns table (
  product_id        uuid,
  titre             text,
  statut            text,
  prix              bigint,
  categorie         text,
  masque_par_equipe boolean,
  created_at        timestamptz,
  photo_path        text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  return query
  select pr.id, pr.title, pr.status::text, pr.price_gnf, c.name, pr.masque_par_equipe, pr.created_at,
         (select pi.storage_path from public.product_images pi
           where pi.product_id = pr.id
           order by pi.position, pi.id
           limit 1)
    from public.products pr
    left join public.categories c on c.id = pr.category_id
   where pr.merchant_id = p_merchant
   order by pr.created_at desc, pr.id;
end;
$$;

comment on function public.equipe_produits_boutique(uuid) is
  'Équipe seule (0067) : tous les produits d''une boutique, tous statuts, avec leur première photo.';

revoke execute on function public.equipe_produits_boutique(uuid) from public, anon;
grant execute on function public.equipe_produits_boutique(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Supprimer un produit
-- ---------------------------------------------------------------------
create or replace function public.supprimer_produit_equipe(p_produit uuid, p_motif text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif    text := btrim(coalesce(p_motif, ''));
  v_titre    text;
  v_merchant uuid;
  v_boutique text;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if char_length(v_motif) not between 3 and 500 then
    raise exception 'Le motif fait de 3 à 500 caractères.';
  end if;

  select pr.title, pr.merchant_id into v_titre, v_merchant
    from public.products pr where pr.id = p_produit
     for update;
  if not found then
    raise exception 'Produit introuvable.';
  end if;
  select m.shop_name into v_boutique from public.merchants m where m.id = v_merchant;

  -- Avant le `delete` : le titre et la boutique ne se liront plus ailleurs.
  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'supprimer_produit', 'produit', p_produit,
         left('« ' || v_titre || ' » (' || coalesce(v_boutique, 'boutique inconnue') || ') : ' || v_motif, 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());

  -- Emporte `product_images` et `campagnes` (cascade) ; `messages.product_id`
  -- passe à null.
  delete from public.products pr where pr.id = p_produit;

  return v_merchant;
end;
$$;

comment on function public.supprimer_produit_equipe(uuid, text) is
  'Équipe seule (0067) : supprime un produit, journal signé avant ; rend le merchant_id (le site efface les photos).';

revoke execute on function public.supprimer_produit_equipe(uuid, text) from public, anon;
grant execute on function public.supprimer_produit_equipe(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 7. Signer une suppression de compte
-- ---------------------------------------------------------------------
create or replace function public.journaliser_suppression_compte(p_profile uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif    text := btrim(coalesce(p_motif, ''));
  v_supprime boolean;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;
  if char_length(v_motif) not between 3 and 500 then
    raise exception 'Le motif fait de 3 à 500 caractères.';
  end if;

  select p.is_deleted into v_supprime
    from public.profiles p where p.id = p_profile
     for update;
  if not found then
    raise exception 'Compte introuvable.';
  end if;
  if not v_supprime then
    raise exception 'Ce compte n''est pas supprimé : rien à inscrire au journal.';
  end if;
  -- Une seule ligne par profil : un envoi rejoué n'écrit rien de plus.
  if exists (select 1 from public.journal_equipe j
              where j.action = 'supprimer_compte' and j.cible_type = 'profil' and j.cible_id = p_profile) then
    return;
  end if;

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'supprimer_compte', 'profil', p_profile, v_motif
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

comment on function public.journaliser_suppression_compte(uuid, text) is
  'Équipe seule (0067) : signe au journal la suppression d''un profil DÉJÀ supprimé (is_deleted) par le site.';

revoke execute on function public.journaliser_suppression_compte(uuid, text) from public, anon;
grant execute on function public.journaliser_suppression_compte(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 8. L'ordre des catégories et des villes se refait seul
-- ---------------------------------------------------------------------
create or replace function public.renumeroter_categories()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.categories c
     set position = r.n
    from (select c2.id, (row_number() over (order by c2.position, c2.name, c2.id))::int as n
            from public.categories c2) r
   where c.id = r.id and c.position <> r.n;
$$;

create or replace function public.renumeroter_villes()
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.cities ci
     set position = r.n
    from (select c2.id, (row_number() over (order by c2.position, c2.name, c2.id))::int as n
            from public.cities c2) r
   where ci.id = r.id and ci.position <> r.n;
$$;

revoke execute on function public.renumeroter_categories() from public, anon, authenticated;
revoke execute on function public.renumeroter_villes()     from public, anon, authenticated;


create or replace function public.retirer_categorie(p_id int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien    public.categories%rowtype;
  v_produits  bigint;
  v_campagnes bigint;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  -- Même verrou que `fixer_categorie` : la renumérotation ne croise pas
  -- une création.
  lock table public.categories in share row exclusive mode;

  select * into v_ancien from public.categories c where c.id = p_id for update;
  if not found then
    raise exception 'Catégorie introuvable.';
  end if;

  select count(*) into v_produits from public.products pr where pr.category_id = p_id;
  if v_produits > 0 then
    raise exception 'Impossible de retirer « % » : % produit(s) l''utilise(nt). Changez-les de catégorie d''abord.',
      v_ancien.name, v_produits;
  end if;
  select count(*) into v_campagnes from public.campagnes ca where ca.category_id = p_id;
  if v_campagnes > 0 then
    raise exception 'Impossible de retirer « % » : % campagne(s) de publicité la visent.',
      v_ancien.name, v_campagnes;
  end if;

  begin
    delete from public.categories c where c.id = p_id;
  exception when foreign_key_violation then
    raise exception 'Impossible de retirer « % » : elle est encore utilisée ailleurs.', v_ancien.name;
  end;

  perform public.renumeroter_categories();

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'retirer_categorie', 'categorie', public.cible_journal_entier(p_id),
         left(v_ancien.name || ' (' || v_ancien.slug || ')', 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

comment on function public.retirer_categorie(int) is
  'Équipe seule (0066, 0067) : retire une catégorie inutilisée, puis renumérote les positions 1..n.';

revoke execute on function public.retirer_categorie(int) from public, anon;
grant execute on function public.retirer_categorie(int) to authenticated;


create or replace function public.retirer_ville(p_id int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien    public.cities%rowtype;
  v_boutiques bigint;
  v_profils   bigint;
begin
  if not public.je_suis_de_l_equipe() then
    raise exception 'Réservé à l''équipe Filloo.';
  end if;

  lock table public.cities in share row exclusive mode;

  select * into v_ancien from public.cities ci where ci.id = p_id for update;
  if not found then
    raise exception 'Ville introuvable.';
  end if;

  select count(*) into v_boutiques from public.merchants m where m.city_id = p_id;
  select count(*) into v_profils   from public.profiles p  where p.city_id = p_id;
  if v_boutiques > 0 or v_profils > 0 then
    raise exception 'Impossible de retirer « % » : % boutique(s) et % profil(s) l''utilisent.',
      v_ancien.name, v_boutiques, v_profils;
  end if;

  begin
    delete from public.cities ci where ci.id = p_id;
  exception when foreign_key_violation then
    raise exception 'Impossible de retirer « % » : elle est encore utilisée ailleurs.', v_ancien.name;
  end;

  perform public.renumeroter_villes();

  insert into public.journal_equipe (auteur, auteur_nom, action, cible_type, cible_id, motif)
  select e.auth_user_id, e.nom, 'retirer_ville', 'ville', public.cible_journal_entier(p_id),
         left(v_ancien.name, 500)
    from public.equipe e where e.auth_user_id = (select auth.uid());
end;
$$;

comment on function public.retirer_ville(int) is
  'Équipe seule (0066, 0067) : retire une ville inutilisée, puis renumérote les positions 1..n.';

revoke execute on function public.retirer_ville(int) from public, anon;
grant execute on function public.retirer_ville(int) to authenticated;


-- Une fois, maintenant : les trous laissés avant cette migration.
select public.renumeroter_categories();
select public.renumeroter_villes();
