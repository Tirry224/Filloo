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
  PAS appliquées.** Les noms d'avant `0015` en production ne portent pas
  tous leur numéro (`realtime_on_messages`, etc.) : comparer avec
  `npm run migrations`, pas à l'œil.
- **Volume au 2026-10-14** : 5 comptes, 6 messages, 14 Mo, 3 objets de
  stockage (133 Ko). Toute mesure de performance faite sur cette base ne
  prouve rien à l'échelle.
- **Realtime : seule la table `messages` est publiée** (constaté
  2026-10-14). Le site écoute tous les `INSERT`, l'app tous les
  événements sans filtre (`Filloo-mobile/src/lib/non-lus.ts`) : coût RLS
  proportionnel au nombre d'abonnés connectés.

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

- Voir `docs/MEMOIRE.md` → « Pièges rencontrés — Sécurité et SQL » : ne
  pas les recopier ici, les relire.

## Décisions du porteur du projet

- Aucune migration ne s'applique sans son accord explicite (CLAUDE.md du
  site).

## Questions ouvertes

- Faut-il fermer `EXECUTE` à `anon` sur toutes les fonctions qui ne sont
  pas appelées par le site ou l'app ? Inventaire à faire.
