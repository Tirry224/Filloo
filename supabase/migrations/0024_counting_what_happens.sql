-- =====================================================================
-- 0024 — Compter ce qui se passe
-- =====================================================================
-- Makiti n'a aucune mesure d'usage. On ne sait donc répondre à AUCUNE des
-- questions qui décident de la suite : combien de visiteurs arrivent
-- jusqu'à une fiche produit, combien vont jusqu'à écrire au commerçant,
-- et surtout — ce qui vaut le plus cher au lancement — quels mots sont
-- tapés dans la recherche sans rien ramener. Cette dernière question dit
-- littéralement quels commerçants aller chercher.
--
-- CE QUE CETTE TABLE NE CONTIENT PAS, et c'est le point central :
--
--   * aucun identifiant de profil, aucun identifiant de connexion ;
--   * aucune adresse IP, aucun agent utilisateur ;
--   * aucun contenu de message.
--
-- `actor_role` dit CE QU'ÉTAIT celui qui a agi (visiteur, client,
-- commerçant), jamais QUI il est. Deux événements du même compte ne se
-- recollent pas : c'est un compteur, pas un journal de comportement. La
-- politique de confidentialité écrite le même jour décrit exactement ce
-- que cette table contient, et c'est elle qui fixe la limite — pas
-- l'inverse.
--
-- `search_query` est la seule exception, et elle est assumée : ce sont
-- des mots tapés par quelqu'un. Sans eux, il reste à deviner ce que les
-- gens cherchent, et une marketplace qui devine recrute les mauvais
-- commerçants. Ils ne sont reliés à personne, et la politique de
-- confidentialité le dit en toutes lettres.
--
-- PAS DE CLÉ ÉTRANGÈRE vers `products` ni `merchants`, volontairement :
-- avec `on delete cascade`, supprimer un produit effacerait l'histoire de
-- ce qu'il a produit ; sans cascade, la suppression deviendrait
-- impossible. Un événement raconte un fait passé, il ne dépend pas de la
-- survie de son sujet. L'identifiant orphelin est le prix, et il se paie
-- volontiers.

create table public.analytics_events (
  id           bigint generated always as identity primary key,
  -- Le nom de l'événement. Pas d'enum : une liste fermée en base
  -- obligerait à une migration pour chaque nouvelle mesure, et c'est
  -- exactement le genre de friction qui fait renoncer à mesurer.
  -- `src/lib/analytics.ts` tient la liste, contrôlée par TypeScript.
  name         text not null check (length(name) between 1 and 60),
  occurred_at  timestamptz not null default now(),

  -- Contexte, tout facultatif : chaque événement ne remplit que ce qui a
  -- du sens pour lui.
  actor_role   text check (actor_role in ('anon', 'client', 'merchant')),
  product_id   uuid,
  merchant_id  uuid,
  category_id  int,
  city_id      int,
  -- Borné : un champ de recherche accepte ce qu'on y colle, et une table
  -- de mesure n'est pas un endroit où stocker un paragraphe.
  search_query text check (length(search_query) <= 120),
  -- Nombre de résultats, pour la question qui compte : une recherche à
  -- zéro résultat est un client perdu ET un commerçant à recruter.
  result_count int
);

-- L'index sert la seule lecture prévue : « cet événement, sur cette
-- période ». Ordre descendant sur la date, parce qu'on regarde toujours
-- les derniers jours.
create index analytics_events_name_time_idx
  on public.analytics_events (name, occurred_at desc);

-- ---------------------------------------------------------------------
-- Sécurité : la table n'existe pas pour l'API
-- ---------------------------------------------------------------------
-- RLS activé SANS AUCUNE POLICY. Ce n'est pas un oubli, c'est la
-- protection : sans policy, PostgREST ne rend jamais une ligne et n'en
-- accepte jamais une. `anon` et `authenticated` ne peuvent donc ni lire
-- les mesures des autres, ni fabriquer de fausses mesures — ce qui
-- rendrait les chiffres inutilisables, le seul vrai risque d'une table
-- de comptage.
--
-- Les écritures passent par `service_role`, qui contourne le RLS, depuis
-- le serveur uniquement (`src/lib/analytics.ts`). Le navigateur ne touche
-- jamais cette table, et aucune fonction RPC ne lui ouvre la porte : un
-- `security definer` accordé à `anon` aurait été exactement le genre de
-- confort administratif qui rouvre une faille (voir les pièges de
-- docs/REPRISE.md).
--
-- La lecture se fait au tableau de bord Supabase, en SQL. Aucun écran
-- d'administration n'existe en v1, et c'est cohérent : la validation des
-- boutiques s'y fait déjà à la main.
alter table public.analytics_events enable row level security;

-- Les privilèges de table, en plus du RLS. Deux verrous distincts : le
-- RLS filtre des lignes, les `grant` décident qui a le droit de poser la
-- question. Révoquer explicitement vaut mieux que de compter sur les
-- réglages par défaut de Supabase — c'est un privilège accordé par défaut
-- au niveau table qui avait permis à un commerçant de s'auto-valider
-- (0002, partie 4).
revoke all on public.analytics_events from anon, authenticated;

comment on table public.analytics_events is
  'Compteurs d''usage. Aucune donnée identifiante : ni profil, ni connexion, ni IP. Écrite par service_role depuis le serveur, lue en SQL au tableau de bord.';
