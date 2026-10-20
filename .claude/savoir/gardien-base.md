# Savoir de gardien-base

Ce fichier est la mémoire de l'agent `gardien-base`. Il décrit l'état
ACTUEL du domaine ; ce qui est devenu faux se corrige ici, l'historique
est dans `git log`. Chaque entrée : date, source, constaté ou supposé.

## Faits de production

- **Projet `bfmsruzyrgbndbueikcb`, Postgres 17, région `eu-west-3`
  (Paris), organisation en offre GRATUITE** — constaté le 2026-10-14
  (connecteur). `max_connections` = 60 (constaté). Limites de l'offre,
  *supposées* (de mémoire, à vérifier sur supabase.com/pricing) : 500 Mo
  de base, 1 Go de stockage, 5 Go de trafic sortant par mois, pas de
  sauvegarde téléchargeable, pause après 7 jours d'inactivité.
- **Migrations appliquées : `0001`–`0035`, puis `0040`, `0038` et `0036`**
  (appliquées le 2026-10-14 par le connecteur, dans cet ordre, accord du
  porteur du projet), **puis `0039`** (le 2026-10-15, par le porteur du
  projet dans le SQL Editor : absente de `list_migrations`, constatée
  par `pg_policies` et `pg_indexes`). `0039` inscrite à la main dans
  `schema_migrations` le 2026-10-20 (version `20261015000000`). **`0037`
  appliquée le 2026-10-20** par le connecteur, accord du porteur du
  projet, avant le nouveau build des téléphones. `0039` et `0040` ne dépendent pas de 0036–0038. Les noms d'avant `0015` en production ne portent pas
  tous leur numéro (`realtime_on_messages`, etc.) : comparer avec
  `npm run migrations`, pas à l'œil.
- **Volume au 2026-10-14** : 5 comptes, 6 messages, 14 Mo, 3 objets de
  stockage (133 Ko). Toute mesure de performance faite sur cette base ne
  prouve rien à l'échelle.
- **Realtime : seule la table `messages` est publiée** (constaté
  2026-10-14). `0038` ajoute une diffusion par canal privé `user:<uid>`
  mais GARDE `messages` publiée : les apps de test installées écoutent
  encore `postgres_changes`. La retirer = migration à part, plus tard.
- **Le schéma `realtime` en production** (constaté 2026-10-14,
  `pg_get_functiondef`, `pg_class`) : `realtime.send(payload, event,
  topic, private default true)` est `security invoker`, fait un
  `SET LOCAL realtime.topic` et **avale toute erreur en `WARNING`** ;
  `realtime.topic()` lit `current_setting('realtime.topic', true)`.
  `realtime.messages` est partitionnée par jour, appartient à
  `supabase_realtime_admin`, RLS actif, `anon`/`authenticated` y ont
  `select, insert, update` (c'est le RLS qui trie) et `execute` sur
  `send`. `postgres` a `BYPASSRLS` : un trigger `security definer` y
  écrit sans politique `insert`.
- **`postgres` peut créer des politiques sur `realtime.messages`,
  `storage.*`, `auth.*` sans en être propriétaire** : réglage
  `supautils.policy_grants` (constaté 2026-10-14).

## Alertes Supabase ouvertes (get_advisors, 2026-10-14)

- **15 fonctions `SECURITY DEFINER` exécutables par `anon`**, 17 par
  `authenticated`. Plusieurs sont des fonctions de trigger (`handle_new_user`,
  `touch_conversation`, `bump_contact_count`…) : un appel RPC direct
  échoue, donc risque faible — *supposé, à prouver une par une*. Les
  fonctions qui renvoient une donnée (`my_profile_id`, `owns_profile`,
  `merchant_is_public`…) sont à examiner en priorité.
- **Protection des mots de passe fuités désactivée** (réglage Auth, pas
  une migration).
- **RLS sans politique sur `analytics_events` et `notifications`** :
  voulu (écriture `service_role` seulement) — *supposé, à confirmer
  dans les migrations 0021 et 0024*.
- **Bucket `product-images` : aucune limite de taille ni de type**
  (constaté), corrigé par `0040` (1 Mo, WebP + JPEG, comme
  `shop-photos`). Au 2026-10-14 : 1 objet, WebP, 6,9 Ko (constaté,
  `storage.objects.metadata`). Clients (constaté, code) : le site envoie
  WebP ou JPEG (`compresserPhoto`, `maxSizeMB: 0.5`), l'app toujours
  `image/jpeg` 1 280 px qualité 0,7 depuis sa 1re version.
- **Performance (get_advisors 2026-10-14)** : 2 FK sans index, 15
  `multiple_permissive_policies` (products, product_images, profiles ×
  5 rôles), 2 `unused_index`. **Aucune `auth_rls_initplan`.** `0039`
  fait disparaître les 2 FK et les 10 de products/product_images ; les
  5 de `profiles` restent (choix de lisibilité de `0006`, gardé).

## Pièges appris

- **Le connecteur Supabase (`apply_migration` comme `execute_sql`) attend
  une confirmation interactive avant toute suppression — `drop … if
  exists` compris — et elle n'arrive jamais en session** : délai dépassé
  à 60 s, RIEN d'appliqué (constaté 2026-10-14, quatre essais sur `0038`).
  Écrire les migrations sans `drop` inutile ; celles qui doivent
  supprimer passent par le SQL Editor du porteur du projet. Après un
  délai dépassé, relire l'état (`schema_migrations`, objets) avant tout
  nouvel essai.

- **Une politique de `realtime.messages` juge le CANAL DEMANDÉ
  (`realtime.topic()`), pas la colonne `topic` de la ligne** (constaté
  2026-10-14, test local de `0038`) : Realtime pose `realtime.topic` puis
  lit la table à l'ouverture du canal. Un test doit donc poser
  `realtime.topic` et vérifier « 0 ligne visible » pour un refus.
- **Tables de transition (`referencing new table`) interdites** sur un
  trigger à plusieurs événements ou à liste de colonnes (`update of`) :
  un trigger par événement, et filtrer `read_at is distinct from` en
  joignant `anciens` (constaté, `0038`).
- **Tester la résistance à une panne de `realtime.send`** : la remplacer
  par une version qui lève dans un `begin … rollback` (voir
  `security_test.sql`, section 0038), le vrai `send` avalant déjà ses
  erreurs.

- **L'alerte `auth_rls_initplan` ne voit que `auth.uid()` écrit en
  clair** : `my_profile_id()` / `my_merchant_id()` (`security definer`,
  jamais dépliées) étaient appelées à CHAQUE ligne sans alerte, et le
  commentaire de `0006` disait le contraire. Constaté par `EXPLAIN` local
  (`0039`) : avant, `Filter` avec 3 appels par ligne ; après,
  `InitPlan 1`. N'envelopper que les appels sans colonne de la ligne.
- **Réécrire une policy : `alter policy`** (nom, rôles, commande,
  permissivité intacts). `supautils.policy_grants` couvre
  `storage.objects`, `storage.buckets`, `realtime.messages` pour
  `postgres` (constaté) ; qu'il couvre `ALTER POLICY` et pas seulement
  `CREATE` est *supposé* — si non, l'application de `0039` échoue en
  bloc.
- **Une policy `for all` est aussi une policy de lecture** : elle double
  la policy SELECT (alerte `multiple_permissive_policies`). La découper
  en insert/update/delete n'est sûr que si sa clause `using` est incluse
  dans la policy SELECT restante (vrai pour products/product_images).
- **Limites de bucket : non testables en local** — c'est le service
  Storage qui refuse (413/415), le stub n'a que la table. On teste le
  réglage dans `storage.buckets`.
- **Tests locaux : pas de `rm -rf` dans un `su -c`** (refusé par le
  garde-fou de suppression). Initialiser un dossier de données NEUF à
  chaque passe (`/var/lib/postgresql/ft-<nom>`, port distinct). Suite au
  2026-10-14 avec 0039–0040 : **183 contrôles OK**.

- Voir `docs/MEMOIRE.md` → « Pièges rencontrés — Sécurité et SQL » : ne
  pas les recopier ici, les relire.

## Décisions du porteur du projet

- Aucune migration ne s'applique sans son accord explicite (CLAUDE.md du
  site).
- `0006` : les deux policies de lecture de `profiles` restent séparées
  par lisibilité (« on optimise quand une mesure le justifie ») —
  constaté dans le fichier ; non rouvert en `0039`.

## Questions ouvertes

- Faut-il fermer `EXECUTE` à `anon` sur toutes les fonctions qui ne sont
  pas appelées par le site ou l'app ? Inventaire à faire.
