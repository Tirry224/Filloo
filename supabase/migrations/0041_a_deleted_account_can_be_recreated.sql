-- =====================================================================
-- 0041 — Un compte supprimé peut être recréé sur la même connexion
-- =====================================================================
-- Depuis le 2026-10-23, une connexion peut supprimer UN seul de ses deux
-- comptes liés (client ou commerçant) et garder l'autre. Le profil
-- supprimé est anonymisé (`is_deleted = true`), jamais effacé : les
-- messages le citent. Le porteur du projet veut qu'on puisse ensuite
-- recréer un compte de ce rôle sur la même connexion.
--
-- Ce qui l'empêchait : `unique (auth_user_id, role)` (0001), qui compte
-- aussi la ligne anonymisée. Elle devient un index unique PARTIEL, qui ne
-- compte que les profils vivants : toujours un seul profil ACTIF par rôle
-- et par connexion, mais autant de profils supprimés que l'histoire en a
-- laissé. Le refus d'un doublon reste une violation d'unicité (23505),
-- comme avant : le site et l'app le lisent de la même façon.
--
-- CE QUI SUPPOSAIT « UNE LIGNE PAR RÔLE » ET EST CORRIGÉ ICI
-- - `my_profile_id(want_role)` (0002, jamais redéfinie depuis) : avec
--   l'ancienne ligne supprimée ET la nouvelle, elle pouvait renvoyer
--   l'ancienne — et toutes les policies qui l'appellent auraient jugé
--   avec le profil mort. Elle ignore désormais les profils supprimés.
--   `my_merchant_id()`, `i_talk_with_merchant`, `conversation_is_open` et
--   les policies passent toutes par elle : corrigées du même coup, sans
--   être réécrites. Conséquence voulue : un compte supprimé ne rouvre
--   plus ses anciens fils par l'autre compte de la connexion.
-- - « profiles: je cree mon second compte » : l'unicité ne bornait plus
--   rien pour une ligne insérée déjà « supprimée » (une session a le
--   droit `insert` sur toute la table, défaut Supabase) ; et un compte
--   SUSPENDU, supprimé puis recréé, repartait sans suspension. La policy
--   refuse donc désormais les deux. Le choix de garder la suspension
--   après une suppression est une décision à confirmer par le porteur
--   du projet : la lever = retirer la dernière condition de la policy.
--
-- CE QUI N'A PAS BESOIN DE CHANGER (relu le 2026-10-23)
-- - `handle_new_user` (0002) : ne crée que le PREMIER profil d'une
--   connexion neuve, en `security definer` (le RLS ne le concerne pas).
-- - `owns_profile`, `is_active_profile` (0005) : jugent un profil précis
--   par son id, pas « le » profil d'un rôle.
-- - `modifier_mes_informations`, `modifier_ma_boutique` (0036) : filtrent
--   déjà `is_deleted = false`.
-- - Policies `profiles` de lecture et de modification : par connexion,
--   toutes les lignes, sans supposer leur nombre.
-- - Aucun `on conflict (auth_user_id, role)` dans le dépôt ; seul l'index
--   de la contrainte en dépend (pg_depend, lu en production).
--
-- APPLICATION : au SQL Editor, par le porteur du projet. Le connecteur
-- Supabase n'arrive jamais à confirmer un `drop` en session (piège du
-- 2026-10-14) et cette migration retire une contrainte. Le nouvel index
-- est créé AVANT le retrait : à aucun moment la table n'est sans
-- unicité. Il échouerait si deux profils actifs du même rôle existaient
-- déjà sur une connexion ; impossible tant que l'ancienne contrainte
-- tient (0 doublon constaté le 2026-10-23). Puis inscrire la migration
-- dans `schema_migrations`.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Un seul profil ACTIF par rôle et par connexion
-- ---------------------------------------------------------------------
-- Nom de la contrainte lu en production le 2026-10-23
-- (`pg_constraint`) : `profiles_auth_user_id_role_key`, nom par défaut
-- de 0001.

create unique index profiles_un_profil_actif_par_role
  on public.profiles (auth_user_id, role)
  where is_deleted = false;

alter table public.profiles
  drop constraint profiles_auth_user_id_role_key;


-- ---------------------------------------------------------------------
-- 2. « Mon profil de tel rôle » ne désigne plus un profil supprimé
-- ---------------------------------------------------------------------
-- Même signature, même `security definer`, même `search_path` : les
-- droits d'exécution existants sont conservés par `create or replace`.
-- Le filtre est `is_deleted`, PAS `is_suspended` : un compte suspendu
-- garde la lecture de ses fils (0017, 0022).

create or replace function public.my_profile_id(want_role public.user_role)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles
  where auth_user_id = auth.uid()
    and role = want_role
    and is_deleted = false;
$$;


-- ---------------------------------------------------------------------
-- 3. Recréer un compte : vivant, et sans effacer une suspension
-- ---------------------------------------------------------------------
-- La policy d'insertion ne peut pas lire `profiles` elle-même (récursion
-- de RLS sur la même table) : la question passe par une fonction
-- `security definer` qui ne répond que sur la connexion active.

create or replace function public.my_role_is_suspended(want_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid()
      and role = want_role
      and is_suspended = true
  );
$$;

comment on function public.my_role_is_suspended(public.user_role) is
  'La connexion active a-t-elle un profil SUSPENDU de ce rôle, supprimé ou non ? Ne répond que sur ses propres profils.';

revoke all on function public.my_role_is_suspended(public.user_role) from public, anon;
grant execute on function public.my_role_is_suspended(public.user_role) to authenticated;

alter policy "profiles: je cree mon second compte" on public.profiles
  with check (
    auth_user_id = (select auth.uid())
    and is_deleted = false
    and not public.my_role_is_suspended(role)
  );
