# Savoir de gardien-base

Mémoire de l'agent `gardien-base`. État ACTUEL ; ce qui devient faux se
corrige ici, l'historique est dans `git log`. Chaque entrée : date,
source, constaté ou supposé.

## Faits de production

- **Projet `bfmsruzyrgbndbueikcb`, Postgres 17, `eu-west-3` (Paris)**,
  organisation passée en **Pro** (constaté 2026-11-06, `docs/MEMOIRE.md`) :
  la base a une sauvegarde quotidienne (7 jours), PAS les fichiers du
  stockage. `max_connections` = 60 (constaté 2026-10-14).
- **Migrations appliquées (constaté 2026-11-07, `list_migrations`)** :
  `0001`–`0047`, puis `0052`–`0054` de l'audit de sécurité, puis NOTRE
  `0055` inscrite sous le nom `0052_a_person_reported_by_five_people_comes_first`
  (version `20261107152647`, nom à corriger par la session principale).
  `0056`, `0057` NON appliquées. `monetisation` porte `0048`–`0051` non
  appliquées ; `scripts/migrations.mjs` n'exige pas la continuité (« hors
  ordre » signalé, sans échec). Ordre réel non numérique autour de
  `0035`–`0040` ; les noms d'avant `0015` ne portent pas tous leur numéro :
  comparer avec `npm run migrations`, pas à l'œil.
- **Volume** : 5 boutiques, base 15 Mo (2026-10-22) ; au plus 2 produits
  publiés par boutique (2026-11-07). Aucune mesure de performance n'y
  prouve rien.
- **Buckets** `product-images` (`0040`) et `shop-photos` (`0029`,
  `0031`) : 1 Mo, `image/webp` et `image/jpeg` seulement.
- **Realtime** : canal privé `user:<uid>` (`0038`) ; `messages` reste en
  `postgres_changes` tant qu'une app l'écoute. `realtime.send` est
  `security invoker` et **avale toute erreur en `WARNING`** ;
  `realtime.topic()` lit `current_setting('realtime.topic', true)`.
  `postgres` a `BYPASSRLS` et crée des politiques sur `realtime.*`,
  `storage.*`, `auth.*` (`supautils.policy_grants`) (constaté 2026-10-14).
- **`profiles` : unicité (connexion, rôle) = index partiel
  `profiles_un_profil_actif_par_role … where is_deleted = false`** (0041,
  appliquée et vérifiée le 2026-10-23).
- **`anon` et `authenticated` ont `INSERT` sur toute la table
  `profiles`** (constaté 2026-10-23, `role_table_grants`) : seule la
  policy d'insertion borne ce qu'une session y écrit, colonnes
  `is_deleted`/`is_suspended` comprises.
- **Vestiges** : `merchants.status` figé à `'approved'` (`0033`) mais lu
  par le RLS ; `profiles.city_id` plus lu par le site depuis le
  2026-10-22, encore écrit par l'app. Ne retirer ni l'un ni l'autre sans
  relecture de compatibilité.

- **`0042`–`0047` appliquées les 2026-11-05/06** (constaté) : équipe
  (`equipe`, écrite en `service_role` seul, `app_metadata.equipe` posé par
  trigger ; membres : Tirry, Alpha Nouhou, Laouratou), fils par espace
  (`fil_equipe.espace`), annonces (cron Vercel `/api/quotidien`, pas
  pg_cron), modération (`journal_equipe`, `masque_par_equipe`), publicité
  sans paiement (`campagnes`, 0 au 2026-11-07). Checks constatés :
  `journal_equipe_action_check`, `journal_equipe_cible_type_check`,
  `campagnes_statut_check`. Détails : en-têtes.
- **Pièges de cette série** : une policy dépend de sa fonction (remplacer
  AVANT de supprimer) ; le RLS refuse avant NOT NULL ; le stub ne donne
  pas `auth` à `authenticated` (une fonction `security invoker` qui lit
  `auth.uid()` y échoue) ; une instruction ne voit pas son propre
  changement (publier puis vérifier, purger puis vérifier = deux
  instructions) ; le stub porte `raw_app_meta_data` ; `postgres` a
  `UPDATE` sur `auth.users`.
- **`0052`–`0054` (audit de sécurité) APPLIQUÉES le 2026-11-07** : `0052`
  ferme l'INSERT de table sur `products` et ne regrante à `authenticated`
  que 8 colonnes (une colonne ajoutée ensuite n'est pas insérable sans
  grant, ex. `masque_par_limite` de `monetisation`, voulu) ; `0053`
  `essais_mot_de_passe`, `0054` `notifications_envoyees` (clés de push
  des messages) : tables serveur seul, purgées à 1 jour par pg_cron.
  Aucun objet commun avec `0055`–`0057` (constaté en lisant les fichiers).
- **`0055` APPLIQUÉE, `0056`–`0057` ÉCRITES sur `dev`** (2026-11-07) :
  `comptes_tres_signales` (5 connexions distinctes ; son `comment` en base
  dit « (0052) », laissé tel quel), trigger `merchants_recoit_la_bienvenue`
  (fil `merchant`), `analytics_events.visiteur_id` + `visiteurs` /
  `visiteurs_uniques` dans `suivi_chiffres`. Constaté en production avant
  `0056`/`0057` : aucun trigger sur `merchants`, seul
  `fil_equipe_heure_du_serveur` sur `fil_equipe`, pas de `visiteur_id`.
- **Nouvelle table de `public` : tout (`arwdDxtm`) à anon, authenticated,
  service_role par défaut** (constaté 2026-11-07, `pg_default_acl`) : une
  table serveur seul fait `revoke all … from public, anon, authenticated`.
  `service_role` a `BYPASSRLS` (constaté, `pg_roles` ; le stub aussi).
- **`0048`–`0051` ÉCRITES, NON APPLIQUÉES, branche `monetisation`**
  (2026-11-07 ; appliquées à sa publication, avec le site) : prix de la
  pub, abonnements + limite Gratuit, crédits, plafond sponsorisés 4 → 6.
  Chacune réécrit les deux checks de `journal_equipe` avec TOUTES les
  valeurs. À sa publication : renuméroter après `0057` (numéros pris sur
  `dev`) — à décider alors.
- **pg_cron 1.6.4, trois tâches** (constaté 2026-11-07, `cron.job`) :
  `purger-mesures`, `purger-essais-mot-de-passe` (3 h 33),
  `purger-notifications-envoyees` (3 h 43).
- **Mesures (`analytics_events`, constaté 2026-11-07)** : écrites par le
  SITE seul, purge à 13 mois (0028). Le site qui écrit `visiteur_id` doit
  partir APRÈS 0057, sinon chaque mesure échoue en silence.
- **App mobile (`/home/user/Filloo-mobile`, constaté 2026-11-07)** :
  `fil_equipe` lu sur sa branche `dev` seulement, pas `main` (stores) ;
  boutique = `insert` direct dans `merchants` sans `.select()` ; publie
  par `update products set status` et affiche tel quel un `P0001` (un
  `raise exception` en français arrive lisible) ; RPC : `search_products`,
  `conversation_is_open`, `enregistrer_telephone` ; supprime des produits
  (cascade vers `campagnes`, trigger 0050).
- **`hidden` sert AUSSI au commerçant** (constaté 2026-11-06, site
  `hideProductAction`/`republishProductAction`) : il masque et republie
  lui-même. Un masquage de l'équipe ne peut donc pas être « status =
  hidden » seul : c'est `masque_par_equipe` (0046) qui le tient.
- **`profiles` : `SELECT` au niveau TABLE pour anon/authenticated**
  (constaté 2026-11-06) : la policy « je vois mes interlocuteurs » montre
  TOUTES les colonnes, `phone` et `suspension_reason` compris. Masquer une
  colonne = révoquer la table et ré-accorder par colonne, ce qui casse
  tout `select('*')` de l'app installée.
- **`reports` : `UPDATE` au niveau table pour anon/authenticated, aucune
  policy d'update ni de delete** (constaté 2026-11-06) : seul le RLS
  ferme l'écriture.

## Alertes Supabase ouvertes (get_advisors, 2026-10-14)

- **15 fonctions `SECURITY DEFINER` exécutables par `anon`**, 17 par
  `authenticated` : celles qui renvoient une donnée (`my_profile_id`,
  `owns_profile`, `merchant_is_public`…) d'abord. Protection des mots de
  passe fuités désactivée (Auth).
- **RLS sans politique, voulu** : `analytics_events` (constaté, `0024`),
  `essais_mot_de_passe`, `notifications_envoyees` (constaté,
  `0053`/`0054`) ; `notifications` : *supposé* pareil (0021).
- **Performance** : les 5 `multiple_permissive_policies` de `profiles`
  restent (choix de lisibilité de `0006`) ; `0039` a réglé le reste.

## Pièges appris

- **`drop` par le connecteur Supabase** : parfois bloqué (délai de
  60 s) ; relire l'état après chaque essai.
- **Une politique de `realtime.messages` juge le canal demandé
  (`realtime.topic()`), pas la colonne `topic`** : un test pose
  `realtime.topic` et vérifie « 0 ligne visible » pour un refus.
- **Tables de transition interdites** sur un trigger à plusieurs
  événements ou à liste de colonnes. Panne de `realtime.send` : la
  remplacer par une version qui lève, dans `begin … rollback` (0038).
- **`auth_rls_initplan` ne voit que `auth.uid()` en clair** :
  `my_profile_id()` était appelée à chaque ligne sans alerte. Vérifier
  par `EXPLAIN` (`InitPlan 1` attendu).
- **Réécrire une policy : `alter policy`.** Une policy `for all` est
  aussi une policy de lecture ; la découper n'est sûr que si sa clause
  `using` est incluse dans la policy SELECT restante.
- **Une unicité qui ignore les lignes supprimées laisse fuir deux
  choses** (2026-10-23, `0041`) : une ligne insérée DÉJÀ supprimée
  (aucune borne), et une sanction (`is_suspended`) effacée par
  « supprimer puis recréer ». Chacune se ferme dans la policy
  d'insertion ; et toute fonction « le profil de tel rôle »
  (`my_profile_id`) doit filtrer `is_deleted = false`.
- **Une policy ne lit pas sa propre table** (récursion de RLS) : passer
  par une fonction `security definer` bornée à `auth.uid()`
  (`my_role_is_suspended`, `0041`).
- **Limites de bucket non testables en local** (c'est le service Storage
  qui refuse) : tester le réglage dans `storage.buckets`.
- **plpgsql `returns table (id …)`** : chaque nom de sortie est une
  variable ; une colonne non qualifiée du même nom devient ambiguë.
  Qualifier toutes les colonnes (`r.id`) dans `return query` (0046).
- **PostgREST ne trouve une fonction que si chaque paramètre ABSENT a un
  défaut** (constaté 2026-11-06, `src/lib/actions/publicite.ts`) :
  supabase-js retire les clés `undefined`, et le site écrit `x ??
  undefined`. Lire les appels `rpc(` du site avant de figer des
  paramètres sans défaut ; un défaut ne change pas l'identité de la
  fonction (types d'arguments), mais impose un défaut aux suivants.
- **Fonction publique `security definer`** (vitrine) : refaire à la main
  les filtres du catalogue (`merchant_is_public` de 0013, `status`,
  `masque_par_equipe`), et prouver chaque filtre par mutation (0047).
- **Tests locaux** : dossier de données NEUF à chaque passe, pas de
  `rm -rf` dans un `su -c` (recette : `.claude/savoir/testeur.md`) ; autre
  port si `54329` est pris ; mutations = une base par migration omise.
  411 contrôles OK le 2026-11-07 (`0001`–`0057` sur `dev`).
- **Deux sessions sur `dev` en parallèle → collision de numéros**
  (2026-11-07) : l'audit a pris `0052`–`0054` pendant que j'écrivais les
  miennes sous les mêmes numéros ; ma `0052` est partie en production
  sous un nom en double, et les uuid de fixture (`a0520000-…`) se
  marchaient dessus. JUSTE AVANT d'écrire : `git fetch` puis
  `git ls-tree origin/dev supabase/migrations/`, et `list_migrations`
  (`supabase_migrations.schema_migrations`) ; prendre le suivant du plus
  grand des deux ; fixtures `a0NN0000-…` = numéro de la migration.
- **`security_test.sql` et son README** : chaque branche ajoute en fin de
  fichier, conflit attendu à chaque fusion ; garder les deux blocs, puis
  vérifier les uuid de fixture en double.
- **`truncate auth.users cascade` (tête de `security_test.sql`) vide
  toute table qui pointe vers `equipe`**, tarifs compris (`monetisation` :
  copies `tarifs_origine`… remises par la section qui en a besoin).
- **`journal_equipe.cible_id` est `uuid not null`** : une cible sans uuid
  reçoit une colonne `id uuid unique`, la colonne ne devient pas nullable.
- **Une mutation doit changer le comportement, une donnée de test doit
  pouvoir faire échouer le filtre** (2026-11-07) : un `coalesce(null, …)`
  laissé en place n'a rien muté ; un produit sans `masque_par_limite` ne
  prouvait pas `not masque_par_equipe`. Une mutation peut tomber sur une
  autre erreur que `ECHEC` (FK vers `equipe`) : muter une garde sans
  écriture signée.
- **Trigger BEFORE ROW** : voit les lignes déjà traitées de la même
  instruction (`volatile`, 0049). **« Jamais bloquant »** se prouve par un
  `check (false) not valid` posé dans `begin … rollback` (0056).
- **Une FK ne se revérifie à l'`update` que si l'ancienne ligne a été
  écrite dans la MÊME transaction** (0050) : tester écriture + suppression
  en cascade dans un `begin … commit`. Garde : le parent existe encore.
- **`produits_sponsorises` tire UN produit par boutique au hasard** :
  plafond testé avec N boutiques, contrôles `>= N` / `= plafond`.
- **Refus par DROIT et par RLS : même code `42501`** : lire
  `sqlerrm like 'permission denied%'` (`pg_temp.refuse`, section 0052).
- **Divers PG** (constaté 2026-11-07) : nom de policy > 63 octets tronqué
  (NOTICE) ; `has_any_column_privilege` refuse `delete` ; une colonne
  `generated always as identity` s'insère sans droit sur la séquence.
- Les pièges SQL généraux sont dans `docs/MEMOIRE.md`, « Pièges
  rencontrés — Sécurité et SQL » : les relire, pas les recopier.

## Décisions du porteur du projet

- Une migration écrite s'applique aussitôt testée, par la session
  principale, SEULEMENT après tests locaux, relecture de compatibilité et
  typecheck (2026-11-06, `CLAUDE.md`) ; SAUF sur la branche
  `monetisation`, appliquée seulement à sa publication. Le gardien
  n'applique jamais. Sur `dev`, la numérotation saute 0048-0051, pris
  par `monetisation` (2026-11-07).
- `0006` : les deux policies de lecture de `profiles` restent séparées
  par lisibilité.
- Un seul des deux comptes liés se supprime, et un compte supprimé peut
  être recréé sur la même connexion (2026-10-23, `0041`).

## Questions ouvertes

- **`0041` garde la suspension après suppression** (un client suspendu
  qui supprime son compte ne le recrée pas) : choix du gardien, à faire
  confirmer par le porteur du projet.
- Fermer `EXECUTE` à `anon` sur les fonctions que ni le site ni l'app
  n'appellent ? Inventaire à faire.
- **`suspension_reason` lisible par l'interlocuteur** de la personne
  suspendue (voir `profiles` plus haut) : à faire trancher par le porteur
  du projet (accepter, ou déplacer le motif dans une table à part lue
  par une fonction).
- La policy « reports: je signale » laisse se signaler soi-même :
  migration à écrire, sur accord.
