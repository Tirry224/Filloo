-- =====================================================================
-- 0069 — Un navigateur sonne pour le compte connecté dessus
-- =====================================================================
-- Ce que la base garantit après cette migration :
--
-- 1. `enregistrer_appareil_push(endpoint, p256dh, auth, user_agent)` donne
--    l'appareil à la connexion qui l'enregistre, même s'il appartenait à
--    une autre.
-- 2. Les neuf fonctions de trigger ne sont plus exécutables par `public`,
--    `anon` ni `authenticated` (alerte `get_advisors`) ; leurs triggers se
--    déclenchent comme avant.
-- 3. `compter_messages_non_lus(espace)` compte les messages non lus d'un
--    espace en une requête, sans liste d'identifiants dans l'URL.
--
-- Aucune policy, aucune colonne, aucune fonction existante ne change de
-- signature : le site déployé (`main`) continue de marcher tel quel. Les
-- deux nouvelles fonctions ne servent qu'une fois le site passé dessus
-- (`src/lib/actions/push.ts`, `src/lib/data/messages.ts`).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Un appareil appartient à la dernière connexion qui l'enregistre
-- ---------------------------------------------------------------------
-- Le trou, constaté en production le 2026-11-07 : 58 erreurs en 24 h
-- « new row violates row-level security policy (USING expression) for
-- table push_subscriptions », 60 réponses 403 sur
-- /rest/v1/push_subscriptions. Le site fait un `upsert(…, { onConflict:
-- "endpoint" })` avec le client de session ; `endpoint` est unique pour
-- TOUTE la table (0023). Quand un navigateur abonné par la connexion A est
-- réenregistré par la connexion B (deux comptes sur un même téléphone,
-- déconnexion puis reconnexion — le site le réenregistre en silence à
-- chaque chargement, `usePushAbonnement.ts`), l'UPDATE du `on conflict`
-- vise la ligne de A et la policy « je mets a jour mon appareil » le
-- refuse. Double conséquence : B ne reçoit rien sur cet appareil, et A
-- continue de recevoir SES notifications sur un appareil qu'utilise B
-- (le nom de ses interlocuteurs et le début de leurs messages, sur
-- l'écran de quelqu'un d'autre).
--
-- La règle, la même que `enregistrer_telephone` (0035, 0068) pour l'app :
-- l'appareil sonne pour la connexion qui s'en sert MAINTENANT. Elle ne
-- peut pas s'écrire en policy (une policy d'UPDATE qui laisserait toucher
-- la ligne d'un autre serait ouverte à toutes les colonnes et à tous les
-- `update` directs) : elle passe par une fonction `security definer` qui
-- n'écrit qu'une chose, « cet endpoint est à moi, avec ces clés ».
--
-- POURQUOI C'EST SÛR (raisonnement relu le 2026-11-07)
-- - L'endpoint est une adresse de capacité (longue, aléatoire) fabriquée
--   par le service de push pour CE navigateur. Seuls le navigateur et le
--   serveur de Filloo la connaissent : le site ne l'affiche jamais, et le
--   RLS ne la montre qu'à la connexion qui la possède.
-- - Un tiers qui la connaîtrait quand même et l'enregistrerait à son nom
--   doit fournir SES clés : il ne connaît pas `auth_secret` de la victime
--   (les deux clés sont écrasées ici, jamais combinées avec les
--   anciennes). Filloo enverra alors à cet appareil les notifications DU
--   TIERS, chiffrées vers les clés du tiers : le navigateur de la victime
--   ne sait pas les déchiffrer et les jette (Web Push, RFC 8291). Les
--   notifications de la victime, elles, ne partent plus vers cet appareil
--   du tout. Le tiers ne lit donc rien de la victime ; il la prive de
--   notifications sur cet appareil, jusqu'à ce que son navigateur se
--   réenregistre — ce que le site fait au prochain chargement.
-- - Correction du raisonnement d'origine : s'il connaissait AUSSI les deux
--   clés de la victime (l'abonnement complet, menace déjà décrite en
--   0023), le tiers ferait afficher sur l'écran de la victime les
--   notifications de SON propre compte, sous le nom de Filloo. Cette
--   fonction n'ajoute rien à cette menace : avec l'abonnement complet, le
--   tiers peut déjà l'insérer sous son nom tant que la victime ne l'a pas
--   enregistré, et c'est la même chose que ce qu'il obtiendrait ici.
-- - Rien de l'ancien propriétaire ne passe au nouveau, qui voit
--   désormais la ligne (policy « je vois mes appareils ») : clés et
--   `user_agent` sont remplacés (même par `null`), et quand la connexion
--   change, `created_at` repart de maintenant et `last_used_at` repart à
--   vide — sinon B apprendrait quand A s'était abonné et quand il avait
--   reçu sa dernière notification.
-- - L'adresse n'est vérifiée ici que dans sa forme (https, taille) : la
--   liste des services de push connus vit dans le site
--   (`src/lib/push-adresse.ts`), et l'envoi (`src/lib/push.ts`) la
--   revérifie avant chaque requête et supprime toute ligne qui n'y est
--   pas. Ce n'est pas un chemin nouveau : la policy d'insertion (0023)
--   accepte déjà n'importe quelle adresse.
--
-- Colonnes de `push_subscriptions` (0023, inchangées depuis, constaté en
-- production le 2026-11-07) : id, auth_user_id, endpoint, p256dh,
-- auth_secret, user_agent, created_at, last_used_at. Toutes sont
-- traitées : `id` et l'endpoint restent, les autres ci-dessous.
--
-- Les policies d'insertion et de mise à jour directes restent : le site
-- déployé s'en sert encore. Elles pourront partir dans une migration
-- suivante, quand plus aucun code de `main` ne les appelle.
create or replace function public.enregistrer_appareil_push(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
  returns void
  language plpgsql
  volatile
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

  -- Une adresse https, d'une taille d'URL, sans espace (une vraie adresse
  -- de push n'en contient jamais). Les adresses réelles font 150 à 400
  -- caractères.
  if p_endpoint is null
     or left(p_endpoint, 8) <> 'https://'
     or length(p_endpoint) > 2048
     or p_endpoint ~ '\s' then
    raise exception 'Adresse de notification invalide.';
  end if;
  -- Les clés font 87 (p256dh) et 22 (auth) caractères en base64url.
  if p_p256dh is null or btrim(p_p256dh) = '' or length(p_p256dh) > 512
     or p_auth is null or btrim(p_auth) = '' or length(p_auth) > 512 then
    raise exception 'Clés de notification invalides.';
  end if;

  insert into public.push_subscriptions as s
    (auth_user_id, endpoint, p256dh, auth_secret, user_agent)
  values (
    (select auth.uid()),
    p_endpoint,
    p_p256dh,
    p_auth,
    nullif(left(p_user_agent, 300), '')
  )
  on conflict (endpoint) do update
    set auth_user_id = excluded.auth_user_id,
        p256dh       = excluded.p256dh,
        auth_secret  = excluded.auth_secret,
        user_agent   = excluded.user_agent,
        -- `s.` = la ligne existante, AVANT la mise à jour.
        created_at   = case when s.auth_user_id = excluded.auth_user_id
                            then s.created_at else now() end,
        last_used_at = case when s.auth_user_id = excluded.auth_user_id
                            then s.last_used_at else null end;
end;
$$;

comment on function public.enregistrer_appareil_push(text, text, text, text) is
  'Enregistre le navigateur de l''appelant pour les notifications push (0069) ; un endpoint déjà connu passe à la connexion qui l''enregistre, avec ses clés à elle. Refusé sans connexion ou pour une connexion fermée (0068).';

revoke all on function public.enregistrer_appareil_push(text, text, text, text) from public, anon;
grant execute on function public.enregistrer_appareil_push(text, text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 2. Les fonctions de trigger ne s'appellent pas de l'extérieur
-- ---------------------------------------------------------------------
-- `get_advisors` signalait 18 fonctions `security definer` exécutables
-- par `anon`. Neuf sont des fonctions de trigger. Vérifié le 2026-11-07,
-- en production (`pg_proc`, `pg_trigger`) et dans le code :
--   - toutes rendent `trigger` et n'ont aucun argument ;
--   - chacune n'est branchée qu'à un trigger : bump_contact_count,
--     check_message_product, check_message_rate_limit, touch_conversation
--     (messages), check_conversation_rate_limit (conversations),
--     check_product_publishable (products), unpublish_products_without_image
--     (product_images), queue_profile_suspension (profiles),
--     handle_new_user (auth.users) ;
--   - aucune n'est appelée hors trigger : `src/` ne les nomme que dans
--     des commentaires, les migrations que dans `create trigger` ;
--   - aucun `grant execute` explicite : le droit venait des privilèges
--     par défaut (PUBLIC, anon, authenticated, service_role).
-- L'alerte n'était pas une faille : PostgreSQL refuse d'appeler une
-- fonction de trigger hors d'un trigger. Le retrait est de l'hygiène, et
-- fait taire neuf alertes pour que les autres se lisent.
--
-- Les triggers continuent de se déclencher : PostgreSQL ne vérifie le
-- droit EXECUTE qu'à la CRÉATION du trigger, pas à son déclenchement.
-- Prouvé dans `security_test.sql` (bloc 0069) pour `authenticated`,
-- `anon` et un rôle sans aucun droit — pas supposé. `service_role` et
-- `postgres` gardent leur droit (rien ne change pour eux).
--
-- NE PAS TOUCHER aux neuf autres fonctions signalées (my_profile_id,
-- owns_profile, merchant_is_public, is_active_profile,
-- i_talk_with_merchant, my_merchant_id, ma_connexion_est_fermee,
-- produits_sponsorises, boutiques_mises_en_avant) : les policies
-- évaluées pour `anon` les appellent, ou ce sont des lectures publiques
-- voulues.
--
-- Attention pour la suite : un `create or replace` garde les droits,
-- mais un `drop function` puis `create` les rend aux privilèges par
-- défaut. Toute réécriture d'une de ces fonctions par drop refait ce
-- `revoke`.
revoke all on function public.bump_contact_count()               from public, anon, authenticated;
revoke all on function public.check_conversation_rate_limit()    from public, anon, authenticated;
revoke all on function public.check_message_product()            from public, anon, authenticated;
revoke all on function public.check_message_rate_limit()         from public, anon, authenticated;
revoke all on function public.check_product_publishable()        from public, anon, authenticated;
revoke all on function public.handle_new_user()                  from public, anon, authenticated;
revoke all on function public.queue_profile_suspension()         from public, anon, authenticated;
revoke all on function public.touch_conversation()               from public, anon, authenticated;
revoke all on function public.unpublish_products_without_image() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Compter les messages non lus d'un espace en une requête
-- ---------------------------------------------------------------------
-- `countUnreadMessages` (`src/lib/data/messages.ts`) lit les id de TOUTES
-- les conversations de l'espace, puis les renvoie dans
-- `.in("conversation_id", [...])` — dans l'URL : au-delà de quelques
-- centaines de fils, l'adresse dépasse la limite et le compteur casse.
--
-- Même sens exact que le code actuel :
--   - espace commerçant : les fils de `my_merchant_id()` ;
--   - espace client : les fils où `client_id = my_profile_id('client')` ;
--   - messages `read_at is null` et `sender_id <>` mon profil de CET
--     espace (`my_profile_id(espace)`, qui ignore un profil supprimé,
--     comme `getMyProfiles`) ;
--   - 0 sans profil (ou sans boutique pour l'espace commerçant).
--
-- `security invoker` : le RLS de `messages` et `conversations` s'applique
-- à l'appelant comme aujourd'hui ; la fonction ne voit rien de plus que
-- ce que le site lisait déjà. Les filtres explicites restent : sans eux,
-- un commerçant qui est aussi client compterait ses deux espaces.
--
-- Index : `conversations_merchant_idx (merchant_id, …)` et
-- `conversations_client_idx (client_id, …)` trouvent les fils,
-- `messages_conversation_idx (conversation_id, created_at)` leurs
-- messages ; `read_at` et `sender_id` se filtrent sur ces lignes.
-- Constaté en production le 2026-11-07 (`pg_indexes`) : aucun index à
-- ajouter (2 fils, 3 messages : aucune mesure n'y prouverait mieux).
create or replace function public.compter_messages_non_lus(p_espace public.user_role)
  returns integer
  language plpgsql
  stable
  security invoker
  set search_path = ''
as $$
declare
  v_profil   uuid := public.my_profile_id(p_espace);
  v_boutique uuid;
  v_nombre   integer;
begin
  if v_profil is null then
    return 0;
  end if;

  if p_espace = 'merchant' then
    v_boutique := public.my_merchant_id();
    if v_boutique is null then
      return 0;
    end if;
    select count(*) into v_nombre
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where c.merchant_id = v_boutique
       and m.read_at is null
       and m.sender_id <> v_profil;
  else
    select count(*) into v_nombre
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where c.client_id = v_profil
       and m.read_at is null
       and m.sender_id <> v_profil;
  end if;

  return v_nombre;
end;
$$;

comment on function public.compter_messages_non_lus(public.user_role) is
  'Nombre de messages non lus reçus dans l''espace donné (client ou commerçant) de l''appelant (0069). Security invoker : le RLS de messages et conversations s''applique.';

revoke all on function public.compter_messages_non_lus(public.user_role) from public, anon;
grant execute on function public.compter_messages_non_lus(public.user_role) to authenticated;
