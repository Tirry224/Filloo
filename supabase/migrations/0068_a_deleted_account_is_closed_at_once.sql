-- =====================================================================
-- 0068 — Un compte supprimé est fermé AUSSITÔT
-- =====================================================================
-- Décision du porteur du projet, 2026-11-07 : « un compte supprimé ou
-- suspendu doit l'être IMMÉDIATEMENT ».
--
-- Le trou. La suppression (site, `src/lib/suppression-compte.ts`,
-- `couperConnexion`) bannit la connexion (`banned_until`, ~100 ans). Mais
-- un bannissement n'invalide ni le jeton d'accès déjà émis (valable
-- jusqu'à son expiration, ~1 h) ni les sessions : PostgREST ne lit que la
-- signature du jeton. Pendant cette heure, tout chemin d'écriture qui ne
-- passe pas par un PROFIL ACTIF restait ouvert — dont « profiles: je cree
-- mon second compte » (0041, 0046) : la personne supprimée recréait un
-- profil neuf sur la connexion bannie (signalé par `relecteur-compat`).
--
-- Ce que la base garantit après cette migration :
--
-- 1. `fermer_les_sessions(p_auth)` (serveur seul) supprime toutes les
--    sessions de la connexion. `auth.refresh_tokens` part par la cascade
--    `refresh_tokens_session_id_fkey … on delete cascade` ; les jetons
--    sans session (anciens formats, 0 en production) sont supprimés
--    explicitement. Ensuite GoTrue refuse `getUser()` (le `session_id` du
--    jeton n'existe plus) — donc toutes les routes `/api/app/*` et les
--    pages du site, qui passent par `getUser()` — et tout rafraîchissement.
--    Constaté en production le 2026-11-07 : `postgres` (propriétaire) a
--    DELETE sur `auth.sessions` et `auth.refresh_tokens`
--    (`has_table_privilege`) et `BYPASSRLS` (le RLS y est activé) ; les
--    deux tables appartiennent à `supabase_auth_admin`, sans trigger.
--    LE SITE DOIT L'APPELER dans `couperConnexion`, après le bannissement.
--
-- 2. `ma_connexion_est_fermee()` : vrai si la connexion de l'appelant est
--    bannie (`banned_until > now()`), supprimée côté Auth (`deleted_at`)
--    ou n'existe plus. Elle ferme, DÈS le bannissement et même avec un
--    jeton encore valable, chaque chemin d'écriture qui ne passe pas par
--    un profil actif (inventaire ci-dessous).
--
-- INVENTAIRE (policies d'écriture de toutes les tables et fonctions
-- `security definer` exécutables par `authenticated`, relu le 2026-11-07,
-- identique en production pour les policies) :
--
-- Couvert ici, parce que seul `auth.uid()` les bornait :
--   - profiles : « je cree mon second compte » (le trou signalé) et
--     « je modifie mon profil » (colonne `city_id`, 0037) ;
--   - push_subscriptions : « j'abonne » et « je mets a jour » ;
--   - expo_push_tokens : `enregistrer_telephone` (la table n'a aucune
--     policy d'insertion ni de modification : la fonction est le seul
--     chemin) ;
--   - `marquer_annonces_lues`, `marquer_fil_equipe_lu` (état de lecture) ;
--   - l'équipe : `je_suis_de_l_equipe()` et `je_suis_proprietaire()`
--     répondent faux pour une connexion fermée. Cela ferme d'un coup les
--     policies d'`annonces`, de `fil_equipe` (réponse de l'équipe) et
--     toutes les fonctions d'équipe (0042–0067) : un membre supprimé ne
--     modère plus pendant l'heure de son jeton.
--
-- Déjà fermé par l'absence de profil actif : la suppression passe
-- `is_deleted = true` AVANT le bannissement, et `my_profile_id` filtre
-- `is_deleted = false` (0041) ; `my_merchant_id`, `is_active_profile`,
-- `je_peux_ecrire_a_l_equipe`, `conversation_is_open` en dépendent :
--   - conversations (création, blocage), messages (envoi, lu), merchants,
--     products, product_images, reports, fil_equipe (« j'ecris dans mon
--     fil »), storage.objects (dossier = `my_merchant_id()`),
--     `demander_campagne`, `annuler_campagne`.
--   - Sans policy d'écriture (RLS fermé) : annonce_destinataires,
--     categories, cities, equipe, journal_equipe, campagnes, tables
--     serveur seul (0053, 0054), analytics_events.
--   - Fonctions de trigger (`handle_new_user`, `bump_contact_count`…) :
--     ne s'appellent pas hors de leur trigger.
--   La suppression d'UN seul des deux comptes liés ne ferme pas la
--   connexion (décision 2026-10-23) : l'autre profil reste actif, et
--   recréer le compte supprimé reste permis (0041).
--
-- 3. SUSPENSION. La base la rendait déjà effective aussitôt pour presque
--    tout : `is_active_profile`, `je_peux_ecrire_a_l_equipe`,
--    `conversation_is_open`, `my_role_is_suspended`, `demander_campagne`
--    lisent `is_suspended` à chaque requête, sans attendre le jeton.
--    Deux trous, fermés ici :
--   - le stockage (0004, 0029, 0039) : un commerçant suspendu envoyait,
--     remplaçait et effaçait encore les photos de son dossier (le bucket
--     est public). Les six policies exigent désormais le profil commerçant
--     actif, comme celles de `products` et `product_images` ;
--   - « profiles: je modifie mon profil » : la ville d'un profil suspendu
--     ou supprimé restait modifiable. Seul un profil actif se modifie.
--   Restent ouverts EXPRÈS à un compte suspendu (non supprimé) : bloquer
--   ou débloquer un fil (se protéger, 0032), marquer un message lu,
--   annuler sa campagne (décision écrite dans 0047), retirer son
--   téléphone ou son abonnement push.
--
-- APP INSTALLÉE (lu sur `origin/dev` et `main` de Filloo-mobile le
-- 2026-11-07) : aucune signature ne change ; pour un compte ni supprimé
-- ni suspendu, chaque condition ajoutée est vraie. Un commerçant SUSPENDU
-- qui tente d'envoyer une photo reçoit désormais un refus du stockage
-- (avant : fichier orphelin, la fiche refusait déjà l'écriture).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Fermer les sessions (serveur seul)
-- ---------------------------------------------------------------------
create or replace function public.fermer_les_sessions(p_auth uuid)
  returns integer
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  v_fermees integer;
begin
  if p_auth is null then
    raise exception 'Connexion manquante.';
  end if;

  -- Les jetons sans session (format d'avant les sessions de GoTrue) : la
  -- cascade ne les atteint pas. `user_id` y est un texte.
  delete from auth.refresh_tokens rt
   where rt.user_id = p_auth::text
     and rt.session_id is null;

  -- Les sessions ; leurs jetons de rafraîchissement suivent par la
  -- cascade (`refresh_tokens_session_id_fkey`, constatée en production).
  delete from auth.sessions s where s.user_id = p_auth;
  get diagnostics v_fermees = row_count;
  return v_fermees;
end;
$$;

comment on function public.fermer_les_sessions(uuid) is
  'Supprime toutes les sessions (et leurs jetons de rafraîchissement) d''une connexion ; rend le nombre de sessions fermées. Serveur seul (service_role) : à appeler par le site juste après le bannissement d''un compte supprimé. GoTrue refuse alors getUser() et tout rafraîchissement.';

revoke all on function public.fermer_les_sessions(uuid) from public, anon, authenticated;
grant execute on function public.fermer_les_sessions(uuid) to service_role;


-- ---------------------------------------------------------------------
-- 2. Ma connexion est-elle fermée ?
-- ---------------------------------------------------------------------
-- Bornée à `auth.uid()` : elle ne dit rien de personne d'autre. Faux pour
-- `anon` (pas de connexion) : les écritures d'un visiteur sont déjà
-- refusées par ailleurs. Ouverte à `anon` parce que les policies qui
-- l'appellent valent pour `public` : sans ce droit, un visiteur
-- recevrait « permission denied for function » au lieu du refus du RLS.
create or replace function public.ma_connexion_est_fermee()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select (select auth.uid()) is not null
     and not exists (
       select 1 from auth.users u
        where u.id = (select auth.uid())
          and u.deleted_at is null
          and (u.banned_until is null or u.banned_until <= now())
     );
$$;

comment on function public.ma_connexion_est_fermee() is
  'Vrai si la connexion de l''appelant est bannie, supprimée côté Auth ou n''existe plus (0068). Ferme les écritures qui ne passent pas par un profil actif, dès le bannissement, même avec un jeton encore valable.';

revoke all on function public.ma_connexion_est_fermee() from public;
grant execute on function public.ma_connexion_est_fermee() to anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- 3. Profils
-- ---------------------------------------------------------------------
alter policy "profiles: je cree mon second compte" on public.profiles
  with check (
    auth_user_id = (select auth.uid())
    and is_deleted = false
    and not public.my_role_is_suspended(role)
    and suspension_reason is null
    and not (select public.ma_connexion_est_fermee())
  );

alter policy "profiles: je modifie mon profil" on public.profiles
  using (
    auth_user_id = (select auth.uid())
    and is_deleted = false
    and is_suspended = false
    and not (select public.ma_connexion_est_fermee())
  )
  with check (
    auth_user_id = (select auth.uid())
    and is_deleted = false
    and is_suspended = false
    and not (select public.ma_connexion_est_fermee())
  );


-- ---------------------------------------------------------------------
-- 4. Téléphones et navigateurs à notifier
-- ---------------------------------------------------------------------
alter policy "push_subscriptions: j''abonne mon appareil" on public.push_subscriptions
  with check (
    auth_user_id = (select auth.uid())
    and not (select public.ma_connexion_est_fermee())
  );

alter policy "push_subscriptions: je mets a jour mon appareil" on public.push_subscriptions
  using (
    auth_user_id = (select auth.uid())
    and not (select public.ma_connexion_est_fermee())
  )
  with check (
    auth_user_id = (select auth.uid())
    and not (select public.ma_connexion_est_fermee())
  );

-- Même corps que 0035, plus la garde. Le `on conflict … do update`
-- réattribue un jeton à l'appelant : une connexion fermée ne doit pas
-- non plus pouvoir s'approprier le téléphone d'un autre.
create or replace function public.enregistrer_telephone(p_token text, p_plateforme text)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Connectez-vous pour recevoir les notifications.';
  end if;
  if public.ma_connexion_est_fermee() then
    raise exception 'Ce compte est fermé.';
  end if;

  insert into public.expo_push_tokens (auth_user_id, token, plateforme)
  values ((select auth.uid()), p_token, p_plateforme)
  on conflict (token) do update
    set auth_user_id = excluded.auth_user_id,
        plateforme   = excluded.plateforme;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. État de lecture des messages de l'équipe (0044)
-- ---------------------------------------------------------------------
create or replace function public.marquer_annonces_lues(p_espace public.user_role)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  update public.annonce_destinataires d
     set lue_at = now()
    from public.annonces a
   where a.id = d.annonce_id
     and d.auth_user_id = (select auth.uid())
     and d.lue_at is null
     and public.annonce_concerne(a.public, p_espace)
     and not public.ma_connexion_est_fermee();
$$;

create or replace function public.marquer_fil_equipe_lu(p_espace public.user_role)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  update public.fil_equipe
     set lu_at = now()
   where fil_de = (select auth.uid())
     and espace = p_espace
     and de_l_equipe = true
     and lu_at is null
     and not public.ma_connexion_est_fermee();
$$;


-- ---------------------------------------------------------------------
-- 6. L'équipe : un membre dont la connexion est fermée n'en est plus
-- ---------------------------------------------------------------------
create or replace function public.je_suis_de_l_equipe()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from public.equipe where auth_user_id = (select auth.uid()))
     and not public.ma_connexion_est_fermee();
$$;

create or replace function public.je_suis_proprietaire()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from public.equipe
                  where auth_user_id = (select auth.uid()) and proprietaire)
     and not public.ma_connexion_est_fermee();
$$;


-- ---------------------------------------------------------------------
-- 7. Stockage : seul un commerçant ACTIF écrit dans son dossier
-- ---------------------------------------------------------------------
-- Même condition que `products` et `product_images` (0039). Un commerçant
-- supprimé était déjà dehors (`my_merchant_id()` nul) ; un suspendu ne
-- l'était pas.
alter policy "photos: envoi dans mon dossier" on storage.objects
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );
alter policy "photos: remplacement dans mon dossier" on storage.objects
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );
alter policy "photos: suppression dans mon dossier" on storage.objects
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );

alter policy "photos boutique: envoi dans mon dossier" on storage.objects
  with check (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );
alter policy "photos boutique: remplacement dans mon dossier" on storage.objects
  using (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );
alter policy "photos boutique: suppression dans mon dossier" on storage.objects
  using (
    bucket_id = 'shop-photos'
    and (storage.foldername(name))[1] = (select public.my_merchant_id())::text
    and (select public.is_active_profile(public.my_profile_id('merchant')))
  );
