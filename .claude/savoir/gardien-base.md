# Savoir de gardien-base

Mémoire de l'agent `gardien-base`. État ACTUEL ; ce qui devient faux se
corrige ici, l'historique est dans `git log`. Chaque entrée : date,
source, constaté ou supposé.

## Faits de production

- **Projet `bfmsruzyrgbndbueikcb`, Postgres 17, `eu-west-3` (Paris)**,
  organisation passée en **Pro** (constaté 2026-11-06, `docs/MEMOIRE.md`) :
  la base a une sauvegarde quotidienne (7 jours), PAS les fichiers du
  stockage. `max_connections` = 60 (constaté 2026-10-14).
- **Migrations appliquées (constaté 2026-11-07, `schema_migrations`)** :
  `0001`–`0047` puis `0052`–`0057` (dernière `20261107153546`, nom de
  0055 corrigé). Les numéros `0048`–`0051` n'existent plus : `monetisation`
  porte `0058`–`0062`, NON appliquées. `scripts/migrations.mjs` n'exige
  pas la continuité (« hors ordre » signalé, sans échec). Ordre réel non numérique autour de
  `0035`–`0040` ; les noms d'avant `0015` ne portent pas tous leur numéro :
  comparer avec `npm run migrations`, pas à l'œil.
- **Volume** : 5 boutiques, base 15 Mo (2026-10-22) ; au plus 2 produits
  publiés par boutique, 0 campagne (2026-11-07) : la limite Gratuit ne
  masque rien au premier passage. Aucune mesure de performance n'y prouve
  rien.
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
  grant, ex. `masque_par_limite` de `0059` : son test attend désormais
  « permission denied », voulu) ; `0053`
  `essais_mot_de_passe`, `0054` `notifications_envoyees` (clés de push
  des messages) : tables serveur seul, purgées à 1 jour par pg_cron.
  Aucun objet commun avec `0055`–`0057` (constaté en lisant les fichiers).
- **`0055`–`0057` APPLIQUÉES** (2026-11-07) : `comptes_tres_signales`,
  trigger `merchants_recoit_la_bienvenue`, `analytics_events.visiteur_id`
  + `visiteurs`/`visiteurs_uniques` dans `suivi_chiffres`.
  `resultats_campagnes` en production = corps de 0047, 0 dépendant
  (constaté 2026-11-07).
- **Nouvelle table de `public` : tout (`arwdDxtm`) à anon, authenticated,
  service_role par défaut** (constaté 2026-11-07, `pg_default_acl`) : une
  table serveur seul fait `revoke all … from public, anon, authenticated`.
  `service_role` a `BYPASSRLS` (constaté, `pg_roles` ; le stub aussi).
- **`0058`–`0062` ÉCRITES, NON APPLIQUÉES, branche `monetisation`**
  (ex-`0048`–`0051`, renumérotées le 2026-11-07 à la fusion de `dev` ;
  appliquées ensemble à sa publication, avec le site) : `0058` prix et
  paiement manuel ; `0059` abonnements, limite Gratuit 10, trigger
  `products_respecte_la_formule`, passe de nuit qui masque EN DERNIER les
  produits d'une campagne `en_attente` ou `active` non finie ; `0060`
  crédits (`lots_credits`, `consommations_credits`, `achats_credits`) ;
  `0061` plafond sponsorisés 4 → 6 ; `0062` colonne `contacts` de
  `resultats_campagnes` (attribution 5 jours, même `visiteur_id`).
  Chacune réécrit les deux checks de `journal_equipe` avec TOUTES les
  valeurs : une suivante repart de la liste de `0060`. Aucune ne touche
  `suivi_chiffres` ni les colonnes de 0052-0057 (constaté en lisant).
- **pg_cron 1.6.4, trois tâches** (constaté 2026-11-07, `cron.job`) :
  `purger-mesures`, `purger-essais-mot-de-passe` (3 h 33),
  `purger-notifications-envoyees` (3 h 43).
- **Mesures (`analytics_events`, constaté 2026-11-07)** : écrites par le
  SITE seul (`compter`, `src/lib/analytics.ts`), purge à 13 mois (0028).
  `produit_vu`/`contact_ouvert`/`whatsapp_ouvert` portent produit +
  boutique, `pub_clic` campagne + boutique, `contact_abouti` la boutique ;
  `message_envoye` ne porte NI boutique NI produit (`actions/messages.ts`,
  envoyé aussi par le commerçant). `visiteur_id` = cookie `filloo_v` posé
  par le middleware sur la requête même.
- **App mobile (`/home/user/Filloo-mobile`, constaté 2026-11-07)** :
  `fil_equipe` lu sur sa branche `dev` seulement, pas `main` (stores) ;
  boutique = `insert` direct dans `merchants` sans `.select()` ; publie
  par `update products set status` et affiche tel quel un `P0001` (un
  `raise exception` en français arrive lisible) ; RPC : `search_products`,
  `conversation_is_open`, `enregistrer_telephone` ; supprime des produits
  (cascade vers `campagnes`, trigger 0060). N'appelle pas
  `resultats_campagnes`.
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

- **Policy de `realtime.messages` : juge `realtime.topic()`**, pas la
  colonne `topic` (test : « 0 ligne visible »). Panne de `realtime.send` :
  la remplacer par une version qui lève, dans `begin … rollback` (0038).
  Tables de transition interdites sur un trigger multi-événements.
- **`auth_rls_initplan` ne voit que `auth.uid()` en clair** : vérifier
  par `EXPLAIN` (`InitPlan 1`) qu'une fonction n'est pas appelée par ligne.
- **Réécrire une policy : `alter policy`** ; une policy `for all` lit
  aussi : la découper seulement si son `using` est inclus dans la SELECT.
- **Unicité qui ignore les supprimés (0041)** : fermer dans la policy
  d'insertion la ligne insérée déjà supprimée et la sanction effacée par
  « supprimer puis recréer » ; `my_profile_id` filtre `is_deleted`.
  Une policy ne lit pas sa propre table : fonction `security definer`.
- **Limites de bucket non testables en local** : tester `storage.buckets`.
- **plpgsql `returns table (id …)`** : qualifier toutes les colonnes
  (`r.id`), chaque nom de sortie est une variable (0046).
- **PostgREST ne trouve une fonction que si chaque paramètre ABSENT a un
  défaut** (2026-11-06) : supabase-js retire les clés `undefined` ; lire
  les `rpc(` du site avant de figer des paramètres sans défaut.
- **Fonction publique `security definer`** (vitrine) : refaire à la main
  les filtres du catalogue (`merchant_is_public` de 0013, `status`,
  `masque_par_equipe`), et prouver chaque filtre par mutation (0047).
- **Tests locaux** : dossier NEUF à chaque passe, pas de `rm -rf` dans
  un `su -c` (recette : `.claude/savoir/testeur.md`), autre port si
  `54329` est pris ; mutations : base modèle sans la migration, puis
  `create database mX template modele`. 706 OK le 2026-11-07
  (`0001`–`0062`, `monetisation` après fusion de `dev`).
- **Numéros en collision entre sessions** (2026-11-07) : JUSTE AVANT
  d'écrire, `git fetch`, `git ls-tree origin/dev supabase/migrations/` et
  `schema_migrations` ; prendre le suivant du plus grand ; fixtures
  `a0NN0000-…` = numéro de la migration (renumérotées avec elle).
- **Fusion : `security_test.sql` et son README** se heurtent en fin de
  fichier ; garder les deux blocs, sections de `dev` d'abord (ordre
  d'application), vérifier uuid et `pg_temp.*` en double (deux
  `pg_temp.refuse` coexistent par surcharge).
- **`truncate auth.users cascade` (tête de `security_test.sql`) vide
  toute table qui pointe vers `equipe`**, tarifs compris : copies
  `tarifs_origine`, `tarifs_abo_origine` ; les sections changent les prix
  (0047 à 0, 0058 : produit 7 j = 25 000) : remettre avant de compter.
- **`returns table` : ajouter une colonne = `drop` puis `create`**
  (`create or replace` refuse un autre type rendu), puis reposer `revoke`
  / `grant` ; vérifier avant qu'aucune vue ni policy n'en dépend
  (`pg_depend`, 0 pour `resultats_campagnes`, constaté 2026-11-07).
- **`set local role` dans une fonction `pg_temp`** : lire les tables
  temporaires AVANT de changer de rôle (`permission denied for table t62`).
- **`journal_equipe.cible_id` est `uuid not null`** : une cible sans uuid
  reçoit une colonne `id uuid unique`, la colonne ne devient pas nullable.
- **Une mutation doit changer le comportement, une donnée de test doit
  pouvoir faire échouer le filtre** (2026-11-07) ; une clause redondante
  survit à sa mutation (`visiteur_id is not null` de 0062) : le dire.
- **Trigger BEFORE ROW** : voit les lignes déjà traitées de la même
  instruction (`volatile`, 0059). **« Jamais bloquant »** se prouve par un
  `check (false) not valid` posé dans `begin … rollback` (0056).
- **Une FK ne se revérifie à l'`update` que si l'ancienne ligne a été
  écrite dans la MÊME transaction** (0060) : tester écriture + suppression
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
  n'applique jamais. `dev` ne réutilise pas 0048-0051 ; `monetisation`
  suit après le plus grand numéro de `dev` (renumérotée à chaque fusion
  de `dev` dans `monetisation`, sens autorisé seul, 2026-11-07).
- **Attribution des contacts à une pub (2026-11-07)** : contact
  (`contact_ouvert`, `whatsapp_ouvert`, `message_envoye`) vers la boutique
  de la campagne, même navigateur, dans les 5 jours APRÈS un `pub_clic`
  (borne de 5 jours incluse) ; navigateurs distincts ; réponse du
  commerçant exclue (choix du gardien, `0062`).
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
