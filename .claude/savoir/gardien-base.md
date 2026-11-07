# Savoir de gardien-base

Mémoire de l'agent `gardien-base`. État ACTUEL ; ce qui devient faux se
corrige ici, l'historique est dans `git log`. Chaque entrée : date,
source, constaté ou supposé.

## Faits de production

- **Projet `bfmsruzyrgbndbueikcb`, Postgres 17, `eu-west-3` (Paris),
  offre GRATUITE** (constaté 2026-10-14). `max_connections` = 60.
  Limites *supposées* (de mémoire, à vérifier sur supabase.com/pricing) :
  500 Mo de base, 1 Go de fichiers, 5 Go de trafic sortant par mois,
  aucune sauvegarde, pause après 7 jours d'inactivité.
- **47 migrations appliquées, `0001` à `0047`** (constaté 2026-11-07,
  `list_migrations`). La branche `monetisation` porte `0048`–`0051`
  NON appliquées ; `0052`–`0054` (dev) sautent ces numéros exprès.
  `scripts/migrations.mjs` et le hook n'exigent pas la continuité
  (constaté) ; appliquer `0048` après `0052` sera signalé « hors ordre »,
  sans échec. Ordre réel en fin de liste : `0035`,
  `0040`, `0038`, `0036`, `0039` (SQL Editor, inscrite à la main le
  2026-10-20, version `20261015000000`), `0037` (2026-10-20). Les noms
  d'avant `0015` ne portent pas tous leur numéro : comparer avec
  `npm run migrations`, pas à l'œil.
- **Volume au 2026-10-22** : 5 boutiques, 2 produits, 6 photos, 17
  messages, base 15 Mo, fichiers 0,76 Mo (photo moyenne 95 Ko). Aucune
  mesure de performance faite sur ce volume ne prouve rien à l'échelle.
- **Buckets** `product-images` (`0040`) et `shop-photos` (`0029`,
  `0031`) : 1 Mo, `image/webp` et `image/jpeg` seulement.
- **Realtime** : canal privé `user:<uid>` (`0038`) ; `messages` reste
  aussi publiée en `postgres_changes` pour les apps de test. La retirer =
  migration à part, quand plus aucune app ne l'écoute.
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

- **`0042`–`0047` appliquées les 2026-11-05/06** (constaté,
  `list_migrations`) : équipe (`equipe`, écrite en `service_role` seul,
  `app_metadata.equipe` posé par trigger, pas d'entrée avant l'email
  confirmé ; membres : Tirry, Alpha Nouhou, Laouratou), fils par espace
  (`fil_equipe.espace`), annonces à cycle (`annonces.etat`, cron 7 h),
  modération (`journal_equipe`, `masque_par_equipe`, checks
  `journal_equipe_action_check`/`_cible_type_check`), publicité sans
  paiement (`campagnes`). Le détail est dans chaque fichier ; 360
  contrôles OK après `0047`.
- **Pièges de ces migrations** : une policy dépend de sa fonction (la
  remplacer AVANT de supprimer l'ancienne) ; le RLS refuse avant NOT
  NULL ; le stub ne donne pas `auth` à `authenticated` (une fonction
  `security invoker` qui lit `auth.uid()` y échoue) ; une instruction ne
  voit pas son propre changement (publier puis vérifier = deux
  instructions) ; le stub porte `raw_app_meta_data` ; `postgres` a
  `UPDATE` sur `auth.users`.
- **`0052`–`0054` ÉCRITES le 2026-11-07, pas appliquées** (389 contrôles
  OK en local) : `0052` ferme l'INSERT de table sur `products` (constaté
  ouvert à anon/authenticated sur TOUTES les colonnes) et ne regrante à
  `authenticated` que les 8 colonnes du site et de l'app ; `0053`
  `essais_mot_de_passe`, `0054` `notifications_envoyees` : tables du
  serveur seul (RLS sans policy, rien pour anon/authenticated), purgées
  à 1 jour par pg_cron (`purger-essais-mot-de-passe` 3 h 33,
  `purger-notifications-envoyees` 3 h 43). Une colonne ajoutée à
  `products` après `0052` n'est pas insérable par le commerçant sans
  grant (ex. `masque_par_limite` de `monetisation`, voulu).
- **Défauts de Supabase sur une NOUVELLE table de `public`** (constaté
  2026-11-07, `pg_default_acl`) : tout (`arwdDxtm`) à anon,
  authenticated et service_role. Une table « serveur seul » doit donc
  `revoke all … from public, anon, authenticated`.
- **`service_role` a `BYPASSRLS`** en production (constaté 2026-11-07,
  `pg_roles`) ; le stub local le lui donne depuis ce jour.
- **pg_cron** : une seule tâche avant `0053` (`purger-mesures`, constaté
  2026-11-07, `cron.job`).
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
  `authenticated`. Les fonctions de trigger échouent en appel direct
  (risque faible, *supposé*) ; celles qui renvoient une donnée
  (`my_profile_id`, `owns_profile`, `merchant_is_public`…) sont à
  examiner en priorité.
- **Protection des mots de passe fuités désactivée** (réglage Auth).
- **RLS sans politique sur `analytics_events` et `notifications`** (et,
  une fois appliquées, `essais_mot_de_passe`, `notifications_envoyees` :
  voulu, constaté dans `0053`/`0054`) :
  voulu, écriture `service_role` seulement (*supposé*, à confirmer dans
  `0021` et `0024`).
- **Performance** : les 5 `multiple_permissive_policies` de `profiles`
  restent (choix de lisibilité de `0006`) ; `0039` a réglé le reste.

## Pièges appris

- **`drop` par le connecteur Supabase** : bloqué le 2026-10-14 (délai
  dépassé à 60 s, rien d'appliqué), passé sans difficulté le 2026-11-05
  dans `apply_migration` (`0044`, quatre `drop function`). Relire
  l'état après chaque essai, dans les deux cas.
- **Une politique de `realtime.messages` juge le canal demandé
  (`realtime.topic()`), pas la colonne `topic`** : un test pose
  `realtime.topic` et vérifie « 0 ligne visible » pour un refus.
- **Tables de transition interdites** sur un trigger à plusieurs
  événements ou à liste de colonnes : un trigger par événement.
- **Tester une panne de `realtime.send`** : la remplacer par une version
  qui lève, dans un `begin … rollback` (section 0038 de
  `security_test.sql`).
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
  389 contrôles OK le 2026-11-07 (avec `0052`–`0054`).
- **Refus par DROIT et refus par RLS ont le même code `42501`**
  (constaté 2026-11-07) : un test de grant qui attrape
  `insufficient_privilege` passerait aussi sur un refus RLS. Lire
  `sqlerrm like 'permission denied%'` (`pg_temp.refuse`, section 0052).
- **`has_any_column_privilege` n'accepte que select, insert, update,
  references** (« unrecognized privilege type: delete », constaté
  2026-11-07, PG 16).
- **Une colonne `generated always as identity` s'insère sans droit sur
  sa séquence** (constaté en local 2026-11-07, `service_role`).
- Les pièges SQL généraux sont dans `docs/MEMOIRE.md`, « Pièges
  rencontrés — Sécurité et SQL » : les relire, pas les recopier.

## Décisions du porteur du projet

- Depuis le 2026-11-06 (`CLAUDE.md`) : une migration écrite s'applique
  aussitôt par la session principale, SEULEMENT après tests locaux,
  relecture de compatibilité et typecheck. Le gardien n'applique jamais.
- `0006` : les deux policies de lecture de `profiles` restent séparées
  par lisibilité.
- Au premier seuil de 50 % d'une limite gratuite, passage en Supabase
  Pro (2026-10-23).
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
