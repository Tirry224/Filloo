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
- **Les 40 migrations du dépôt sont appliquées** (constaté 2026-10-23,
  `schema_migrations` : 40 lignes). Ordre réel en fin de liste : `0035`,
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
  `pg_constraint` ; seul dépendant : son index). `0041` (écrite, NON
  appliquée au 2026-10-23) la remplace par l'index partiel
  `profiles_un_profil_actif_par_role … where is_deleted = false`.
- **`anon` et `authenticated` ont `INSERT` sur toute la table
  `profiles`** (constaté 2026-10-23, `role_table_grants`) : seule la
  policy d'insertion borne ce qu'une session y écrit, colonnes
  `is_deleted`/`is_suspended` comprises.
- **Vestiges** : `merchants.status` figé à `'approved'` (`0033`) mais lu
  par le RLS ; `profiles.city_id` plus lu par le site depuis le
  2026-10-22, encore écrit par l'app. Ne retirer ni l'un ni l'autre sans
  relecture de compatibilité.

## Alertes Supabase ouvertes (get_advisors, 2026-10-14)

- **15 fonctions `SECURITY DEFINER` exécutables par `anon`**, 17 par
  `authenticated`. Les fonctions de trigger échouent en appel direct
  (risque faible, *supposé*) ; celles qui renvoient une donnée
  (`my_profile_id`, `owns_profile`, `merchant_is_public`…) sont à
  examiner en priorité.
- **Protection des mots de passe fuités désactivée** (réglage Auth).
- **RLS sans politique sur `analytics_events` et `notifications`** :
  voulu, écriture `service_role` seulement (*supposé*, à confirmer dans
  `0021` et `0024`).
- **Performance** : les 5 `multiple_permissive_policies` de `profiles`
  restent (choix de lisibilité de `0006`) ; `0039` a réglé le reste.

## Pièges appris

- **Le connecteur Supabase attend une confirmation avant tout `drop`,
  qui n'arrive jamais en session** : délai dépassé à 60 s, rien
  d'appliqué (2026-10-14). Écrire sans `drop` inutile ; ce qui doit
  supprimer passe par le SQL Editor du porteur du projet. Relire l'état
  avant tout nouvel essai.
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
- **Tests locaux** : un dossier de données NEUF à chaque passe, pas de
  `rm -rf` dans un `su -c` (recette dans `.claude/savoir/testeur.md`).
  194 contrôles OK le 2026-10-23 (avec `0041`), 183 sans.
- Les pièges SQL généraux sont dans `docs/MEMOIRE.md`, « Pièges
  rencontrés — Sécurité et SQL » : les relire, pas les recopier.

## Décisions du porteur du projet

- Aucune migration ne s'applique sans son accord explicite, en disant
  qu'elle touchera la production (`CLAUDE.md`).
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
- La policy « reports: je signale » laisse se signaler soi-même :
  migration à écrire, sur accord.
