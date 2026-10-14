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
- **Migrations appliquées : jusqu'à `0035`** — constaté le 2026-10-14
  (`list_migrations`). **`0036` et `0037` sont commitées sur `dev` mais
  PAS appliquées ; `0038` (diffusion par canal privé) est écrite, non
  appliquée.** Les noms d'avant `0015` en production ne portent pas
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
  (constaté par requête sur `storage.buckets`), alors que `shop-photos`
  est limité à 1 Mo, WebP et JPEG. Un fichier énorme ou non-image peut y
  être déposé.
- **Performance** : clés étrangères sans index sur
  `notifications.profile_id` et `profiles.city_id` ; politiques SELECT
  multiples sur `products`, `product_images`, `profiles`. Sans effet à ce
  volume.

## Pièges appris

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

- Voir `docs/MEMOIRE.md` → « Pièges rencontrés — Sécurité et SQL » : ne
  pas les recopier ici, les relire.

## Décisions du porteur du projet

- Aucune migration ne s'applique sans son accord explicite (CLAUDE.md du
  site).

## Questions ouvertes

- Faut-il fermer `EXECUTE` à `anon` sur toutes les fonctions qui ne sont
  pas appelées par le site ou l'app ? Inventaire à faire.
