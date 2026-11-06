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

- **`0042` appliquée le 2026-11-05** (constaté : 42 lignes dans
  `schema_migrations`, 4 tables sous RLS, 7 policies ; types régénérés
  identiques à ceux écrits à la main). Envoyée par `apply_migration` sans
  les commentaires du fichier : les instructions sont les mêmes.
  L'équipe est une table à part (`equipe`, écrite seulement en
  `service_role`), pas une valeur de `user_role`. Membres au 2026-11-05 :
  le porteur du projet (« Tirry »), Alpha Nouhou Diallo (« Alpha
  Nouhou ») et Laouratou Barry (« Laouratou », ajoutée après
  confirmation de son email), inscrits par la session sur sa demande.
  Règle suivie : pas d'entrée dans l'équipe avant l'email confirmé.

- **`0043` appliquée le 2026-11-05** sur accord du porteur du projet
  (constaté : 43 migrations, trigger présent, Tirry et Alpha Nouhou
  marqués, fonction fermée à `authenticated`) : trigger sur `equipe`
  qui pose ou retire `app_metadata.equipe` dans `auth.users` (le site la
  lit sans requête), et annonces qui ne partent plus vers l'équipe. 225
  contrôles OK en local. Constaté le 2026-11-05 : `postgres` a `UPDATE`
  sur `auth.users` (propriétaire `supabase_auth_admin`). Le stub local
  porte désormais `raw_app_meta_data`.

- **`0044` appliquée le 2026-11-05** sur accord du porteur du projet
  (constaté : 44 migrations, `espace` obligatoire, anciennes fonctions
  retirées, le fil existant rangé côté client) : `fil_equipe.espace`
  (client ou commerçant), un fil par (personne, espace) ; fonctions de
  « lu » et `boite_equipe` par espace, `je_peux_ecrire_a_l_equipe(espace)`
  (suspension par compte), annonce à laquelle on répond seulement depuis
  l'espace qu'elle concerne (`annonce_concerne`). Le seul fil existant
  (2 messages, écrits côté client) est rangé côté client. 234 contrôles
  OK en local. Piège : une policy dépend de sa fonction, la remplacer
  AVANT de supprimer l'ancienne ; et le RLS refuse avant NOT NULL.

- **`0045` appliquée le 2026-11-06** sur accord du porteur du projet
  (constaté : 45 migrations, 2 triggers, 4 policies, cron seul à pouvoir
  publier les programmées ; types régénérés identiques) : `annonces.etat`
  (brouillon, programmée, publiée, retirée), cycle tenu par un trigger
  (`annonce_tenir_le_cycle`, `security definer` : il lit `auth.uid()`
  pour signer), destinataires figés à la PUBLICATION, retrait au lieu de
  suppression, `publier_annonces_programmees()` (service_role, cron 7 h),
  `lecteurs_annonce()`. 252 contrôles OK en local. Piège : le stub local
  ne donne pas `auth` à `authenticated` ; une fonction `security invoker`
  qui lit `auth.uid()` y échoue. Piège de test : une instruction ne voit
  pas son propre changement (publier puis vérifier = deux instructions).

- **`0046` ÉCRITE, NON APPLIQUÉE** (2026-11-06) : modération par
  l'équipe (`suspendre_profil`, `reactiver_profil`, `masquer_produit`,
  `traiter_signalement`, `signalements_a_traiter`, `messages_signales`,
  `comptes_suspendus`), `journal_equipe`, `profiles.suspension_reason`,
  `reports.handled_by`/`decision`, `products.masque_par_equipe`. 301
  contrôles OK en local ; le test « commercant republie » tombe sans le
  déclencheur (vérifié en le retirant). À corriger ici une fois appliquée.
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
- **RLS sans politique sur `analytics_events` et `notifications`** :
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
- **`suspension_reason` lisible par l'interlocuteur** de la personne
  suspendue (voir `profiles` plus haut) : à faire trancher par le porteur
  du projet (accepter, ou déplacer le motif dans une table à part lue
  par une fonction).
- La policy « reports: je signale » laisse se signaler soi-même :
  migration à écrire, sur accord.
