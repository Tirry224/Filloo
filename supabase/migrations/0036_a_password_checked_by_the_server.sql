-- =====================================================================
-- 0036 — Le mot de passe redemandé est vérifié par le serveur
-- =====================================================================
-- « Mes informations » (nom, téléphone) et « Modifier ma boutique » (nom,
-- ville, adresse, WhatsApp, description, photo) redemandent le mot de
-- passe : réécrire le WhatsApp ou l'adresse d'une boutique détourne ses
-- acheteurs. Mais le site comme l'app vérifiaient ce mot de passe PUIS
-- écrivaient avec la session de la personne — et cette session, seule,
-- peut appeler `update` directement, sans aucun mot de passe (constaté
-- le 2026-10-11). Le mot de passe ne protégeait que l'écran.
--
-- Ces deux fonctions sont désormais le seul chemin d'écriture : le site
-- vérifie le mot de passe, puis les appelle avec `service_role`
-- (`src/lib/coordonnees.ts`). 0037 retire ensuite le droit d'écrire ces
-- colonnes directement.
--
-- Pourquoi deux migrations : celle-ci ne retire rien, elle s'applique
-- tout de suite sans gêner l'app déjà installée. 0037 casse l'ancienne
-- version de l'app (qui écrit en direct) : elle attend que la nouvelle
-- soit sur les téléphones.
--
-- `security definer` + exécution réservée à `service_role`, comme 0028 :
-- l'identifiant reçu vient du jeton vérifié par le site, jamais d'une
-- saisie. Appelables par un compte connecté, elles rouvriraient
-- exactement la faille qu'elles ferment ; les tests le vérifient.

-- Mêmes lignes que la policy "profiles: je modifie mon profil" (0006) :
-- tous les profils de la connexion, puisque nom et téléphone appartiennent
-- à la connexion et non au rôle. Un profil supprimé (anonymisé) est en
-- plus écarté : le réécrire défairait l'anonymisation.
create or replace function public.modifier_mes_informations(
  p_auth_user_id uuid,
  p_nom text,
  p_telephone text
)
returns int
language sql
security definer
set search_path = ''
as $$
  with modifies as (
    update public.profiles
       set full_name = p_nom,
           phone     = p_telephone
     where auth_user_id = p_auth_user_id
       and is_deleted = false
    returning 1
  )
  select count(*)::int from modifies;
$$;

revoke all on function public.modifier_mes_informations(uuid, text, text) from public, anon, authenticated;
grant execute on function public.modifier_mes_informations(uuid, text, text) to service_role;

-- Mêmes lignes que la policy "merchants: je modifie ma boutique" (0002) :
-- la boutique du profil commerçant de la connexion, profil actif
-- (`is_active_profile`). Rend l'id de la boutique, ou null si aucune ligne
-- n'a été écrite — un refus ne passe pas pour un enregistrement.
-- Un champ facultatif vide arrive en '' et s'enregistre null, comme avant
-- (les types générés ne permettent pas de passer null à une fonction).
-- Les contraintes de la table (dont `merchants_photo_path_dans_son_dossier`,
-- 0029) s'appliquent comme avant.
create or replace function public.modifier_ma_boutique(
  p_auth_user_id uuid,
  p_nom text,
  p_ville_id int,
  p_adresse text,
  p_whatsapp text,
  p_description text,
  p_photo_path text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  update public.merchants m
     set shop_name      = p_nom,
         city_id        = p_ville_id,
         address_hint   = nullif(p_adresse, ''),
         whatsapp_phone = nullif(p_whatsapp, ''),
         description    = nullif(p_description, ''),
         photo_path     = nullif(p_photo_path, '')
    from public.profiles p
   where p.id = m.profile_id
     and p.auth_user_id = p_auth_user_id
     and p.role = 'merchant'
     and p.is_suspended = false
     and p.is_deleted = false
  returning m.id;
$$;

revoke all on function public.modifier_ma_boutique(uuid, text, int, text, text, text, text) from public, anon, authenticated;
grant execute on function public.modifier_ma_boutique(uuid, text, int, text, text, text, text) to service_role;
