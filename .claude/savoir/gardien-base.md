# Savoir de gardien-base

Mémoire de l'agent `gardien-base`. État ACTUEL ; ce qui devient faux se
corrige ici, l'historique est dans `git log`. Chaque entrée : date,
source, constaté ou supposé.

## Faits de production

- **Projet `bfmsruzyrgbndbueikcb`, Postgres 17, `eu-west-3` (Paris)**,
  organisation passée en **Pro** (constaté 2026-11-06, `docs/MEMOIRE.md`) :
  la base a une sauvegarde quotidienne (7 jours), PAS les fichiers du
  stockage. `max_connections` = 60 (constaté 2026-10-14).
- **Migrations appliquées : jusqu'à `0047` incluse** (constaté
  2026-11-07, dernière version `20261106030837`). Ordre réel non
  numérique autour de `0035`–`0040` ; les noms d'avant `0015` ne portent
  pas tous leur numéro : comparer avec `npm run migrations`.
- **Volume** : 5 boutiques, base 15 Mo (2026-10-22) ; au plus 2 produits
  publiés par boutique (2026-11-07) : la limite Gratuit ne masque rien au
  premier passage. Aucune mesure de performance n'y prouve rien.
- **Buckets** `product-images` (`0040`) et `shop-photos` (`0029`,
  `0031`) : 1 Mo, `image/webp` et `image/jpeg` seulement.
- **Realtime** : canal privé `user:<uid>` (`0038`) ; `messages` reste en
  `postgres_changes` tant qu'une app l'écoute.
- **Schéma `realtime`** (constaté 2026-10-14) : `realtime.send(payload,
  event, topic, private default true)` est `security invoker` et **avale
  toute erreur en `WARNING`** ; `realtime.topic()` lit
  `current_setting('realtime.topic', true)`. `postgres` a `BYPASSRLS`.
- **`postgres` peut créer des politiques sur `realtime.messages`,
  `storage.*`, `auth.*`** sans en être propriétaire
  (`supautils.policy_grants`, constaté 2026-10-14).
- **`profiles` : unicité (connexion, rôle)** = contrainte
  `profiles_auth_user_id_role_key` en production (constaté 2026-10-23,
  `pg_constraint` ; seul dépendant : son index). `0041` (APPLIQUÉE le
  2026-10-23, vérifié : contrainte absente, index présent, policy et
  `my_profile_id` à jour) la remplace par l'index partiel
  `profiles_un_profil_actif_par_role … where is_deleted = false`.
- **`anon` et `authenticated` ont `INSERT` sur toute la table
  `profiles`** (constaté 2026-10-23, `role_table_grants`) : seule la
  policy d'insertion borne ce qu'une session y écrit, colonnes
  `is_deleted`/`is_suspended` comprises.
- **Vestiges** : `merchants.status` figé à `'approved'` (`0033`) mais lu
  par le RLS ; `profiles.city_id` plus lu par le site depuis le
  2026-10-22, encore écrit par l'app. Ne retirer ni l'un ni l'autre sans
  relecture de compatibilité.

- **`0042`–`0046` appliquées les 2026-11-05/06** (constaté à chaque fois
  dans `schema_migrations`). `0042` : l'équipe est une table à part
  (`equipe`, écrite seulement en `service_role`), membres Tirry, Alpha
  Nouhou, Laouratou ; pas d'entrée avant l'email confirmé. `0043` :
  trigger qui pose `app_metadata.equipe` dans `auth.users` (`postgres` a
  `UPDATE` dessus). `0044` : un fil par (personne, espace). `0045` :
  cycle des annonces par trigger, cron 7 h. `0046` : modération,
  `journal_equipe`, `products.masque_par_equipe`. Détails dans les
  en-têtes de ces migrations.
- **Pièges de cette série** : une policy dépend de sa fonction (remplacer
  AVANT de supprimer) ; le RLS refuse avant NOT NULL ; le stub local ne
  donne pas `auth` à `authenticated` (une fonction `security invoker` qui
  lit `auth.uid()` y échoue) ; une instruction ne voit pas son propre
  changement (publier puis vérifier = deux instructions).
- **`0047` APPLIQUÉE le 2026-11-06** : publicité sans paiement. 0
  campagne en production au 2026-11-07 (constaté). Noms constatés des
  checks : `journal_equipe_action_check`, `journal_equipe_cible_type_check`,
  `campagnes_statut_check`.
- **`0048` et `0049` ÉCRITES, NON APPLIQUÉES** (2026-11-07, branche
  `monetisation`, appliquées seulement à sa publication, avec le site) :
  `0048` = prix et paiement manuel de la publicité ; `0049` = abonnements
  Pro/Business, limite Gratuit 10 produits (`products.masque_par_limite`,
  trigger `products_respecte_la_formule`, cron `appliquer-limites-abonnement`
  3 h 41), statistiques. `0049` LIT `moyens_paiement` (0048) : jamais
  l'une sans l'autre. Chacune réécrit les deux checks de `journal_equipe`
  avec TOUTES les valeurs précédentes : une suivante doit repartir de la
  liste de 0049. Suite locale : 531 contrôles OK (108 pour 0049).
- **pg_cron 1.6.4 en production, une seule tâche `purger-mesures`**
  (constaté 2026-11-07) : le cycle des annonces (0045) passe par le cron
  Vercel `/api/quotidien`, pas pg_cron.
- **Mesures (`analytics_events`) au 2026-11-07** (constaté) : écrites par
  le SITE seul (l'app n'en écrit aucune) ; `recherche` 6 048, `visite`
  3 501, `produit_vu` 126, `boutique_vue` 45, `contact_ouvert` 43,
  `whatsapp_ouvert` 16, `contact_abouti` 4. `produit_vu`, `contact_ouvert`,
  `whatsapp_ouvert` portent `product_id` + `merchant_id` ; `boutique_vue`
  `merchant_id` seul ; `recherche` porte `search_query` (déjà en
  minuscules) et `category_id`, jamais de boutique. Purge à 13 mois (0028).
- **App mobile (clone `/home/user/filloo-mobile`, constaté 2026-11-07)** :
  publie par `update products set status` (création = insert `draft`,
  photos, puis `active` ; republication ; remise en vente), et affiche
  tel quel le message d'une erreur `P0001` (`lisible`, `changerStatut`).
  Un `raise exception` en français dans un trigger de `products` arrive
  donc lisible à l'écran. RPC appelées : `search_products`,
  `conversation_is_open`, `enregistrer_telephone` seulement.
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
- **RLS sans politique sur `analytics_events`** : voulu (constaté en
  lisant `0024`, 2026-11-07) ; `notifications` : *supposé* pareil (0021).
- **Performance** : les 5 `multiple_permissive_policies` de `profiles`
  restent (choix de lisibilité de `0006`) ; `0039` a réglé le reste.

## Pièges appris

- **`drop` par le connecteur Supabase** : bloqué une fois (2026-10-14,
  délai de 60 s), passé ensuite (2026-11-05) ; relire l'état après chaque
  essai.
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
- **Tests locaux** : un dossier de données NEUF à chaque passe, pas de
  `rm -rf` dans un `su -c` (recette dans `.claude/savoir/testeur.md`).
- **`truncate auth.users cascade` (tête de `security_test.sql`) vide
  toute table qui pointe vers `equipe`**, même une table de référence
  pré-remplie (`tarifs_publicite.modifie_par` 0048, `tarifs_abonnement`
  0049) : la garder avant le `truncate` (`tarifs_origine`,
  `tarifs_abo_origine`). Une section ancienne rejoue après
  TOUTES les migrations : la section 0047 remet les tarifs à 0 pour
  tester son chemin gratuit.
- **`journal_equipe.cible_id` est `uuid not null`** : une table cible
  sans uuid (tarifs, moyens) reçoit une colonne `id uuid unique` plutôt
  que rendre la colonne nullable (type lu par le site).
- **Vérifier qu'une mutation change vraiment le comportement** : un
  `coalesce(null, (sous-requête), now())` laissé en place n'a rien muté
  (2026-11-07). Muter le geste lui-même (`v_debut := now()`).
- **Une donnée de test doit pouvoir faire échouer le filtre** : un
  produit masqué par l'équipe SANS `masque_par_limite` ne prouvait pas
  le filtre `not masque_par_equipe` de `restaurer_produits_masques` ; il
  a fallu un produit portant les deux drapeaux.
- **Un trigger BEFORE ROW voit les lignes déjà traitées de la même
  instruction** (fonction `volatile`) : une limite comptée dans le
  trigger tient aussi sur une mise à jour groupée (prouvé, 0049).
- **Port du Postgres de test** : une autre session peut tenir déjà
  `54329` ; prendre un autre port (`54339`) plutôt qu'arrêter le sien.
- **Une mutation peut tomber sur une autre erreur que `ECHEC`** (clé
  étrangère vers `equipe` quand un non-membre signe) : la suite s'arrête
  quand même, mais pour une preuve nette, muter une garde sans écriture
  signée (ex. `revenus_publicite`).
- **Test aléatoire** : `produits_sponsorises` garde UN produit par
  boutique au hasard : une campagne par boutique et par emplacement.
- Les pièges SQL généraux sont dans `docs/MEMOIRE.md`, « Pièges
  rencontrés — Sécurité et SQL » : les relire, pas les recopier.

## Décisions du porteur du projet

- Une migration écrite s'applique aussitôt testée, par la session
  principale (2026-11-06, `CLAUDE.md`) ; SAUF sur la branche
  `monetisation`, appliquée seulement à sa publication. Le gardien
  n'applique jamais.
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
