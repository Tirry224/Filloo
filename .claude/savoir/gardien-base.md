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
  `0001`–`0047`, puis `0052`–`0057` (le nom de `0055` est corrigé). Sur
  `dev` les numéros sautent `0048`–`0062` : `monetisation` porte
  `0058`–`0062` (renumérotées, constaté `origin/monetisation`), non
  appliquées. `0063`–`0066` ÉCRITES sur `dev` (gestion depuis `/admin`),
  pas encore appliquées à la fin de la mission. `scripts/migrations.mjs`
  n'exige pas la continuité. Ordre réel non numérique autour de
  `0035`–`0040`, noms d'avant `0015` sans numéro : comparer avec
  `npm run migrations`, pas à l'œil.
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
  `0056` bienvenue des boutiques, `0057` `visiteur_id`. Détails : en-têtes.
  Avec `0065`, `equipe` s'écrit aussi par `ajouter_membre`/`retirer_membre`.
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
  `0064`–`0066` (`demasquer_produit`, `ajouter_membre`, `retirer_membre`,
  `fixer_categorie`, `retirer_categorie`, `fixer_ville`, `retirer_ville` ;
  cibles `membre`, `categorie`, `ville`). À sa publication (renumérotée
  après `0066`) : ajouter ces valeurs à ses trois réécritures, sinon le
  `add constraint` échoue (lignes existantes) ou, journal sans ces
  lignes, chaque geste de gestion échoue ensuite au journal.
- **pg_cron 1.6.4, trois tâches** (constaté 2026-11-07, `cron.job`) :
  `purger-mesures`, `purger-essais-mot-de-passe` (3 h 33),
  `purger-notifications-envoyees` (3 h 43).
- **Mesures (`analytics_events`)** : écrites par le SITE seul, purge à
  13 mois (0028) (constaté 2026-11-07).
- **App mobile (`/home/user/Filloo-mobile`, constaté 2026-11-07)** :
  `fil_equipe` lu sur sa branche `dev` seulement, pas `main` (stores) ;
  `main` lit `categories`/`cities` en `(id, name)` triées par `position`,
  et `categories(name)` en jointure ; ne touche pas `equipe` ;
  boutique = `insert` direct dans `merchants` sans `.select()` ; publie
  par `update products set status` et affiche tel quel un `P0001` (un
  `raise exception` en français arrive lisible) ; RPC : `search_products`,
  `conversation_is_open`, `enregistrer_telephone` ; supprime des produits
  (cascade vers `campagnes`, trigger 0050).
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
  `email_confirmed_at`, `deleted_at`, `is_anonymous` (le stub aussi).

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
  2026-11-07 (`0001`–`0066`). Omettre une migration qui crée des
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
- **Trigger BEFORE ROW** : voit les lignes déjà traitées de la même
  instruction (`volatile`, 0049). **« Jamais bloquant »** se prouve par un
  `check (false) not valid` posé dans `begin … rollback` (0056).
- **Une FK ne se revérifie à l'`update` que si l'ancienne ligne a été
  écrite dans la MÊME transaction** (0050) : tester écriture + suppression
  en cascade dans un `begin … commit`. Garde : le parent existe encore.
- **`produits_sponsorises` tire UN produit par boutique au hasard** :
  plafond testé avec N boutiques, contrôles `>= N` / `= plafond`.
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
- Fermer `EXECUTE` à `anon` sur les fonctions que ni le site ni l'app
  n'appellent ? Inventaire à faire.
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
