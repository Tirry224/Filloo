# Savoir de gardien-base

Mémoire de l'agent `gardien-base`. État ACTUEL ; ce qui devient faux se
corrige ici, l'historique est dans `git log`. Chaque entrée : date,
source, constaté ou supposé.

## Faits de production

- **Projet `bfmsruzyrgbndbueikcb`, Postgres 17, `eu-west-3` (Paris)**,
  organisation passée en **Pro** (constaté 2026-11-06, `docs/MEMOIRE.md`) :
  la base a une sauvegarde quotidienne (7 jours), PAS les fichiers du
  stockage. `max_connections` = 60 (constaté 2026-10-14).
- **Migrations appliquées (constaté 2026-11-07 soir, `list_migrations`)** :
  `0001`–`0047`, `0052`–`0057`, `0063`–`0067` (`0067` inscrite avec la
  version `0067`, pas un horodatage). Sur `dev` les numéros
  sautent `0048`–`0062` : `monetisation` porte `0058`–`0062`
  (renumérotées, constaté `origin/monetisation`), non appliquées.
  `0068` appliquée (version `0068`, constaté `list_migrations` le
  2026-11-07 tard). `0069` (push à la dernière connexion, triggers fermés,
  non-lus) ÉCRITE et testée le 2026-11-07, non appliquée à la fin de la
  mission. `scripts/migrations.mjs`
  n'exige pas la continuité. Ordre réel non numérique autour de
  `0035`–`0040`, noms d'avant `0015` sans numéro : comparer avec
  `npm run migrations`, pas à l'œil.
- **Volume** : 5 boutiques, 15 Mo (2026-10-22), ≤ 2 produits publiés par
  boutique (2026-11-07) : aucune mesure de performance n'y prouve rien.
  Buckets `product-images` (`0040`), `shop-photos` (`0029`, `0031`) :
  1 Mo, webp/jpeg.
- **Realtime** : canal privé `user:<uid>` (`0038`) ; `messages` reste en
  `postgres_changes` tant qu'une app l'écoute. `realtime.send` est
  `security invoker` et **avale toute erreur en `WARNING`** ;
  `realtime.topic()` lit `current_setting('realtime.topic', true)`.
  `postgres` a `BYPASSRLS` et crée des politiques sur `realtime.*`,
  `storage.*`, `auth.*` (`supautils.policy_grants`) (constaté 2026-10-14).
- **`profiles` : unicité (connexion, rôle) = index partiel
  `profiles_un_profil_actif_par_role … where is_deleted = false`** (0041,
  appliquée et vérifiée le 2026-10-23).
- **Vestiges** : `merchants.status` figé à `'approved'` (`0033`) mais lu
  par le RLS ; `profiles.city_id` plus lu par le site depuis le
  2026-10-22, encore écrit par l'app. Ne retirer ni l'un ni l'autre sans
  relecture de compatibilité.

- **Série `0042`–`0057`, appliquée** (constaté 2026-11-07) : équipe
  (`equipe`, `app_metadata.equipe` posé/retiré par trigger 0043 ;
  membres : Tirry, Alpha Nouhou, Laouratou), fils par espace, annonces
  (cron Vercel, pas pg_cron), modération (`journal_equipe`,
  `masque_par_equipe`), publicité sans paiement (`campagnes`, 0 ligne) ;
  audit `0052` (INSERT de `products` limité à 8 colonnes : une colonne
  ajoutée ensuite n'est pas insérable sans grant), `0053`/`0054` (tables
  serveur seul purgées par pg_cron) ; `0055` `comptes_tres_signales`,
  `0056` bienvenue des boutiques (texte : `texte_de_bienvenue_boutique()` de `0071`), `0057` `visiteur_id`. Détails : en-têtes.
  Avec `0065`, `equipe` s'écrit aussi par `ajouter_membre`/`retirer_membre`,
  réservées au PROPRIÉTAIRE depuis `0067` (`equipe.proprietaire`, un seul,
  posé sur le plus ancien : Tirry, 2026-11-05 21:15, aucune égalité,
  constaté 2026-11-07). Toutes les autres fonctions d'équipe restent
  ouvertes à tout membre.
- **Pièges de cette série** : une policy dépend de sa fonction (remplacer
  AVANT de supprimer) ; le RLS refuse avant NOT NULL ; le stub ne donne
  pas `auth` à `authenticated` ; une instruction ne voit pas son propre
  changement (agir puis vérifier = deux instructions) ; `postgres` a
  `UPDATE` sur `auth.users`.
- **Nouvelle table de `public` : tout (`arwdDxtm`) à anon, authenticated,
  service_role par défaut** (constaté 2026-11-07, `pg_default_acl`) : une
  table serveur seul fait `revoke all … from public, anon, authenticated`.
  `service_role` a `BYPASSRLS` (constaté, `pg_roles` ; le stub aussi).
- **`0058`–`0062` ÉCRITES, NON APPLIQUÉES, branche `monetisation`**
  (2026-11-07 ; appliquées à sa publication, avec le site) : prix de la
  pub, abonnements + limite Gratuit, crédits, plafond sponsorisés 4 → 6,
  contact après clic. `0058`–`0060` réécrivent les deux checks de
  `journal_equipe` avec LEUR liste complète, SANS les valeurs de
  `0064`–`0067` (`demasquer_produit`, `ajouter_membre`, `retirer_membre`,
  `fixer_categorie`, `retirer_categorie`, `fixer_ville`, `retirer_ville`,
  `supprimer_produit`, `supprimer_compte` ; cibles `membre`, `categorie`,
  `ville`). À sa publication (renumérotée
  après `0066`) : ajouter ces valeurs à ses trois réécritures, sinon le
  `add constraint` échoue (lignes existantes) ou, journal sans ces
  lignes, chaque geste de gestion échoue ensuite au journal.
- **pg_cron 1.6.4** (constaté 2026-11-07) : `purger-mesures`,
  `purger-essais-mot-de-passe`, `purger-notifications-envoyees`.
  `analytics_events` écrite par le SITE seul, purge à 13 mois (0028).
- **App mobile ABANDONNÉE** (décision du 2026-11-07, `CLAUDE.md`) : plus
  de relecture de compatibilité avec `Filloo-mobile` ; seuls comptent le
  site de `main` et des installations encore en circulation (RPC qu'elle
  appelait : `search_products`, `conversation_is_open`,
  `enregistrer_telephone` ; ne pas les casser sans raison).
- **`hidden` sert AUSSI au commerçant** (constaté 2026-11-06, site
  `hideProductAction`/`republishProductAction`) : il masque et republie
  lui-même. Un masquage de l'équipe ne peut donc pas être « status =
  hidden » seul : c'est `masque_par_equipe` (0046) qui le tient.
- **Droits de table constatés** (`role_table_grants`) : anon/authenticated
  ont `INSERT` et `SELECT` sur TOUTE `profiles` (2026-10-23/11-06 : seule
  la policy borne l'insertion ; la policy « interlocuteurs » montre toutes
  les colonnes, `phone`, `suspension_reason` compris ; masquer une
  colonne casserait les `select('*')` de l'app) ; `UPDATE` de table sur
  `reports` sans policy d'update (le RLS seul ferme). 2026-11-07 :
  `categories`/`cities` avaient `TRUNCATE`/`REFERENCES`/`TRIGGER`
  (retirés par `0066`), `equipe` toute écriture (retirée par `0065`).
- **Divers constatés 2026-11-07** : `campagnes.category_id` → `categories`
  sans `on delete` ; `journal_equipe` vide en production ; `auth.users` a
  `email_confirmed_at`, `deleted_at`, `is_anonymous`, `last_sign_in_at`
  (le stub aussi). `merchants.rejection_reason` N'EXISTE PLUS (0033) :
  `equipe_compte` rend un `null::text` sous ce nom pour le site.
  Positions avant `0067` : catégories 2..9, villes 1, 2, 4, 6..9.
- **Supprimer un produit emporte** (constaté 2026-11-07, `pg_constraint`) :
  `product_images` et `campagnes` (cascade), `messages.product_id` → null ;
  restent `reports.target_id` et `analytics_events.product_id` (sans FK).
  Les fichiers du stockage ne partent que par le site.

- **Auth, constaté 2026-11-07** (`pg_constraint`, `has_table_privilege`) :
  `refresh_tokens.session_id → sessions on delete cascade`,
  `sessions.user_id → users on delete cascade` ; `refresh_tokens.user_id`
  est un TEXTE ; tables à `supabase_auth_admin`, RLS activé, sans
  trigger ; `postgres` y a DELETE (et BYPASSRLS). `auth.jwt()` lit
  `request.jwt.claims`. 9 sessions, 17 jetons, 0 jeton sans session,
  0 connexion bannie.
- **Fermer un compte (`0068`)** : un bannissement n'invalide ni le jeton
  (~1 h, PostgREST ne lit que la signature) ni les sessions. La base
  ferme les écritures dès `banned_until` par `ma_connexion_est_fermee()`
  (policies sans profil actif, `enregistrer_telephone`, `marquer_*`,
  `je_suis_de_l_equipe`/`je_suis_proprietaire`) ; `fermer_les_sessions`
  (service_role) fait refuser `getUser()` par GoTrue — le site doit
  l'appeler dans `couperConnexion` (à faire, `src/lib/suppression-compte.ts`).
  Toute NOUVELLE policy d'écriture bornée au seul `auth.uid()` doit
  porter la garde. Les lectures restent ouvertes jusqu'à expiration
  (sans profil actif, elles ne montrent presque rien). L'app appelle
  `signOut()` global (`notifications.ts`) : une garde sur le
  `session_id` du jeton couperait les autres appareils avant leur
  rafraîchissement — écartée, à ne pas ajouter sans décision.
- **Suspension** : effective aussitôt par `is_active_profile` & co ;
  restent ouverts EXPRÈS au suspendu : bloquer/débloquer (0032), marquer
  lu, annuler sa campagne (0047), retirer téléphone/abonnement.

## Alertes Supabase ouvertes (get_advisors, constaté 2026-11-07)

- **18 `SECURITY DEFINER` exécutables par `anon`, 57 par `authenticated`**.
  `0069` retire les 9 fonctions de trigger (restent 9 pour anon : aides
  du RLS et vitrines publiques, VOULUES — ne pas y toucher). Les ~48
  d'`authenticated` sont des RPC gardées (équipe, `my_*`) : alerte
  attendue pour toute nouvelle RPC definer. Protection des mots de passe
  fuités désactivée (Auth).
- **RLS sans politique, voulu** : `analytics_events` (constaté, `0024`),
  `essais_mot_de_passe`, `notifications_envoyees` (constaté,
  `0053`/`0054`) ; `notifications` : *supposé* pareil (0021).
- **Performance** : les 5 `multiple_permissive_policies` de `profiles`
  restent (choix de lisibilité de `0006`) ; `0039` a réglé le reste.

## Pièges appris

- **`drop` par le connecteur** : parfois bloqué (60 s) ; relire l'état.
- **Realtime** : une policy de `realtime.messages` juge le canal demandé
  (`realtime.topic()`), pas la colonne : refus = « 0 ligne visible » ;
  panne de `realtime.send` = la remplacer par une version qui lève, dans
  `begin … rollback` (0038). Tables de transition interdites sur un
  trigger à plusieurs événements ou à liste de colonnes.
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
- **Une policy ne lit pas sa propre table** (récursion) : fonction
  `security definer` bornée à `auth.uid()` (`0041`). Limites de bucket :
  tester le réglage dans `storage.buckets` (Storage refuse, pas Postgres).
- **plpgsql `returns table (id …)`** : chaque nom de sortie est une
  variable ; une colonne non qualifiée du même nom devient ambiguë.
  Qualifier toutes les colonnes (`r.id`) dans `return query` (0046).
- **Une recherche « chiffres seuls du téléphone » ne s'applique qu'à une
  saisie qui ressemble à un numéro** (`0063`) : sinon un email
  `x0063@` trouve tout téléphone contenant `0063`.
- **PostgREST ne trouve une fonction que si chaque paramètre ABSENT a un
  défaut** (constaté 2026-11-06) : supabase-js retire les clés
  `undefined`, et le site écrit `x ?? undefined` ; un défaut impose un
  défaut aux suivants. Le site code souvent les écrans EN PARALLÈLE :
  lire ses `rpc(` (`src/lib/actions/*`, `src/lib/data/*`) AVANT de figer
  une signature (`0066` : `p_id` d'abord → défauts partout).
- **Fonction publique `security definer`** (vitrine) : refaire à la main
  les filtres du catalogue (`merchant_is_public` de 0013, `status`,
  `masque_par_equipe`), et prouver chaque filtre par mutation (0047).
- **Tests locaux** : dossier NEUF à chaque passe, pas de `rm -rf` dans un
  `su -c` (recette : `.claude/savoir/testeur.md`). 477 contrôles OK le
  2026-11-07 (`0001`–`0066`), 524 avec `0067`, 561 avec `0068`, 611
  avec `0069` (`/var/tmp/rejouer.sh` rejoue tout).
  Une garde ajoutée à `using` ET `with check` se mute dans les deux, sinon
  la suite tombe sur une erreur brute du `with check`, pas sur l'`ECHEC`.
  Une garde redondante pour la donnée (profil déjà supprimé) ne se prouve
  qu'avec une donnée où elle est seule (banni, profil actif). En `authenticated`, un
  contrôle qui compte dans une table passe par le RLS (l'équipe ne voit
  pas les brouillons de `products`) : écrire la valeur attendue en dur.
  Une garde inatteignable (unicité) se prouve en levant l'index dans
  `begin … rollback` ; une règle de backfill se met dans une fonction
  interne (revoke all) pour être rejouée par les tests (`0067`). Omettre une migration qui crée des
  fonctions ne prouve que leur absence : muter ses GARDES (sauvegarde,
  `perl -0pi`, restaurer, `cmp` ; accents dans le motif = octets, écrire
  `[^\n]*`). Aides : `pg_temp.erreur_de(q)` (message exact),
  `pg_temp.refuse(q)` (droit, même code `42501` que le RLS). Une date de
  fixture relative perd contre les sections précédentes : `now()` dans
  une instruction postérieure.
- **Deux sessions en parallèle → collision de numéros** (2026-11-07,
  `0052` en double en production). JUSTE AVANT d'écrire : `git fetch` puis
  `git ls-tree origin/dev supabase/migrations/`, et `list_migrations`
  (`supabase_migrations.schema_migrations`) ; prendre le suivant du plus
  grand des deux ; fixtures `a0NN0000-…` = numéro de la migration.
- **`security_test.sql` et son README** : chaque branche ajoute en fin de
  fichier ; à la fusion garder les deux blocs, vérifier les uuid en double.
- **`truncate auth.users cascade` (tête de `security_test.sql`) vide
  toute table qui pointe vers `equipe`**, tarifs compris (`monetisation` :
  copies `tarifs_origine`… remises par la section qui en a besoin).
- **`journal_equipe.cible_id` est `uuid not null`** : une cible sans uuid
  reçoit une colonne `id uuid unique` (tables neuves, `monetisation`), ou,
  pour une table existante lue par l'app (`categories`, `cities`), un uuid
  DÉDUIT de l'id entier : `public.cible_journal_entier(int)` (`0066`).
- **Une mutation doit changer le comportement, une donnée de test doit
  pouvoir faire échouer le filtre** (2026-11-07) ; vérifier que la
  mutation a pris (`cmp`) et qu'elle tombe sur un `ECHEC`, pas une autre
  erreur.
- **Trigger BEFORE ROW** voit les lignes déjà traitées de l'instruction
  (0049) ; « jamais bloquant » se prouve par un `check (false) not valid`
  dans `begin … rollback` (0056) ; une FK ne se revérifie à l'`update` que
  si l'ancienne ligne a été écrite dans la MÊME transaction (0050).
- **`produits_sponsorises` tire UN produit par boutique au hasard** :
  plafond testé avec N boutiques, contrôles `>= N` / `= plafond`.
- **EXECUTE d'une fonction de trigger n'est vérifié qu'à la création du
  trigger** (prouvé `0069` en PG16 : anon, authenticated et un rôle sans
  aucun droit déclenchent les 9 triggers après `revoke`). Appeler une
  fonction de trigger hors trigger est de toute façon impossible : alerte
  advisor non exploitable. Un `drop function` + `create` rend les droits
  par défaut (refaire le `revoke`) ; `create or replace` les garde.
- **`upsert` du client de session sur une colonne unique pour TOUTE la
  table** (`push_subscriptions.endpoint`) : si la ligne est à un autre,
  l'UPDATE du `on conflict` tombe sur le `using` → « violates row-level
  security policy (USING expression) » (58/24 h en production le
  2026-11-07). Remède : fonction definer qui donne la ligne à l'appelant,
  et efface tout ce qui trahirait l'ancien (dates, user_agent) puisque le
  nouveau la lit ensuite (`0069`, comme `enregistrer_telephone`). Dans
  `on conflict do update`, l'alias de la table (`as s`) = ligne existante.
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
  n'applique jamais. Sur `dev`, la numérotation saute `0048`–`0062`
  (`monetisation`, 2026-11-07).
- **Tout le site s'administre depuis `/admin`, tout membre de l'équipe a
  les mêmes droits** (2026-11-07) : chaque geste qui écrit passe par une
  fonction `security definer` gardée par `je_suis_de_l_equipe()` et signée
  dans `journal_equipe` (`0063`–`0066`).
- `0006` : les deux policies de lecture de `profiles` restent séparées
  par lisibilité.
- Un seul des deux comptes liés se supprime, et un compte supprimé peut
  être recréé sur la même connexion (2026-10-23, `0041`).

## Questions ouvertes

- **`0041` garde la suspension après suppression** (un client suspendu
  qui supprime son compte ne le recrée pas) : choix du gardien, à faire
  confirmer par le porteur du projet.
- Après `0069` et le passage du site sur `enregistrer_appareil_push` :
  retirer les policies d'insertion/mise à jour directes de
  `push_subscriptions` (migration suivante, quand `main` ne s'en sert
  plus). Le site doit aussi appeler `compter_messages_non_lus`.
- **`suspension_reason` lisible par l'interlocuteur** de la personne
  suspendue (voir `profiles` plus haut) : à faire trancher par le porteur
  du projet (accepter, ou déplacer le motif dans une table à part lue
  par une fonction).
- `docs/MEMOIRE.md` dit « Neuf catégories, douze villes : rien ne bouge
  sans un besoin constaté » (2026-09-23) ; `0066` donne l'outil à
  l'équipe (décision du 2026-11-07) : la session principale doit
  réconcilier les deux phrases.
- La policy « reports: je signale » laisse se signaler soi-même :
  migration à écrire, sur accord.
