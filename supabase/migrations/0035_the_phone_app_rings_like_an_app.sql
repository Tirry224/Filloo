-- =====================================================================
-- 0035 : l'app mobile sonne comme une vraie application
-- =====================================================================
-- Décision du porteur du projet du 2026-10-07 : les nouvelles demandes et
-- les nouveaux messages arrivent par la NOTIFICATION DU TÉLÉPHONE, comme
-- dans n'importe quelle application ; les emails ne servent plus qu'au
-- compte (confirmer l'adresse, réinitialiser le mot de passe).
--
-- `push_subscriptions` (0023) ne convient pas : elle porte des abonnements
-- WEB PUSH (endpoint + deux clés de chiffrement), qu'un navigateur
-- fabrique. L'app mobile, elle, reçoit d'Expo un JETON
-- (`ExponentPushToken[…]`) qu'Expo relaie vers Apple ou Google. Deux
-- formats, deux tables : les mélanger obligerait chaque ligne à porter des
-- colonnes vides selon son type.
--
-- MÊMES CHOIX QUE 0023, POUR LES MÊMES RAISONS
-- - `auth_user_id`, pas `profile_id` : une connexion porte parfois deux
--   profils (client et commerçant), le téléphone est le même.
-- - Le jeton est UNIQUE : un téléphone qui se réinscrit remplace sa ligne,
--   sinon chaque message sonnerait deux fois. Quand un AUTRE compte se
--   connecte sur le même téléphone, la ligne change de propriétaire (voir
--   la fonction plus bas) : le téléphone ne doit sonner que pour la
--   personne connectée.
-- - Un jeton donne le droit de faire sonner un téléphone : il ne sort
--   jamais vers un écran. Seul le serveur (clé `service_role`) le lit pour
--   envoyer ; le RLS ne laisse chacun voir que ses propres téléphones.

create table public.expo_push_tokens (
  id           uuid primary key default gen_random_uuid(),
  -- Un compte supprimé emporte ses téléphones : un jeton mort ne laisse
  -- rien à lire à personne (même raisonnement qu'en 0023).
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  -- La forme que produit `getExpoPushTokenAsync`. Le contrôle écarte une
  -- chaîne quelconque, qui ferait échouer chaque envoi sans raison claire.
  token        text not null unique
               check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'),
  -- « ios » ou « android » : descriptif, pour savoir de quel téléphone on
  -- parle en cas de plainte. Jamais lu par l'envoi.
  plateforme   text check (plateforme in ('ios', 'android')),
  created_at   timestamptz not null default now(),
  -- Renseigné à chaque envoi accepté par Expo.
  last_used_at timestamptz
);

create index expo_push_tokens_user_idx on public.expo_push_tokens (auth_user_id);

comment on table public.expo_push_tokens is
  'Un téléphone portant l''app mobile, joignable par notification via Expo. Lu par l''envoi côté serveur ; jamais affiché à personne.';


-- ---------------------------------------------------------------------
-- RLS : chacun ne voit et ne retire QUE ses propres téléphones
-- ---------------------------------------------------------------------
alter table public.expo_push_tokens enable row level security;

create policy "expo_push_tokens: je vois mes telephones"
  on public.expo_push_tokens for select
  using (auth_user_id = (select auth.uid()));

-- À la déconnexion, l'app retire son jeton : le téléphone cesse de sonner
-- pour un compte qui n'y est plus ouvert.
create policy "expo_push_tokens: je retire mon telephone"
  on public.expo_push_tokens for delete
  using (auth_user_id = (select auth.uid()));

-- Pas de policy d'insertion ni de mise à jour : l'enregistrement passe par
-- la fonction ci-dessous, seule à pouvoir reprendre un jeton déjà connu
-- sous un autre compte — ce qu'aucune policy ne saurait autoriser sans
-- laisser chacun s'approprier les téléphones des autres.


-- ---------------------------------------------------------------------
-- Enregistrer le téléphone de la personne connectée
-- ---------------------------------------------------------------------
-- Le jeton désigne un TÉLÉPHONE. S'il était déjà inscrit sous un autre
-- compte, c'est que ce téléphone a changé de main (déconnexion qui n'a
-- pas pu retirer le jeton, faute de réseau) : il passe à la personne qui
-- vient de s'y connecter, seule à le tenir en ce moment. Sans cela, le
-- nouvel utilisateur recevrait les messages de l'ancien.
--
-- `security definer` pour écrire par-dessus la ligne d'un autre compte ;
-- le propriétaire est toujours `auth.uid()`, jamais un paramètre : on ne
-- peut inscrire un téléphone qu'à SON nom.
create function public.enregistrer_telephone(p_token text, p_plateforme text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Connectez-vous pour recevoir les notifications.';
  end if;

  insert into public.expo_push_tokens (auth_user_id, token, plateforme)
  values ((select auth.uid()), p_token, p_plateforme)
  on conflict (token) do update
    set auth_user_id = excluded.auth_user_id,
        plateforme   = excluded.plateforme;
end;
$$;

revoke all on function public.enregistrer_telephone(text, text) from public, anon;
grant execute on function public.enregistrer_telephone(text, text) to authenticated;
