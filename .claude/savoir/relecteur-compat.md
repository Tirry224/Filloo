# Savoir de relecteur-compat

Mémoire de l'agent `relecteur-compat`. État ACTUEL ; l'historique est
dans `git log`. Chaque entrée : date, source, constaté ou supposé.

## Ce qui rend l'app fragile

- **Pas d'`expo-updates`, pas de mise à jour forcée** (constaté
  2026-10-14, `app.json`) : un correctif passe par les stores, et les
  anciennes versions restent installées.
- **`src/lib/database.types.ts` de l'app est une copie à la main** de
  celui du site : il peut être en retard d'une migration.

## Versions de l'app en circulation

- **Aucune version publiée sur les stores** au 2026-10-14 ; des versions
  de test circulent depuis le 2026-10-09. Tant que c'est vrai, un
  changement cassant ne touche que des testeurs. À remplacer ici dès la
  première publication (version, date, commit).

## Ce dont l'app dépend (inventaire du 2026-10-14, commit `167f006`)

Point de départ seulement : **toujours recalculer par `grep`** dans
l'app.

- **Routes du site** : `/api/app/message-envoye`,
  `/api/app/supprimer-compte`, `/api/app/mes-informations`,
  `/api/app/ma-boutique`.
- **RPC** : `search_products`, `conversation_is_open`,
  `enregistrer_telephone`.
- **Buckets** : `product-images`, `shop-photos` (l'app envoie toujours
  `image/jpeg`, 1 280 px, qualité 0,7).
- **Realtime** : `postgres_changes` sur `messages` dans les versions de
  test (`EcranFil.tsx`, `non-lus.ts`). **Retirer `messages` de
  `supabase_realtime` casse leur direct et leur pastille.** Le canal
  privé `user:<uid>` (`0038`) est sur une branche de l'app, pas encore
  dans `dev` au 2026-10-14.
- **Écritures directes** : `products`, `product_images`,
  `conversations` (`blocked_by`), `messages` (`read_at`), `profiles`
  (insert, **`city_id`**), `merchants` (insert), `reports`.
- **Lectures** : en plus des précédentes, `expo_push_tokens`, `cities`,
  `categories`.

## Relectures récentes

- **2026-10-22 et 2026-10-23, site seul (aucune migration, aucune route
  `/api/app/*` modifiée)** : fin du filtre de ville (le site ne lit plus
  `profiles.city_id`, l'app peut continuer de l'écrire), remise en vente
  d'un produit vendu (`sold → active`, déjà permis par `0020`), cloche et
  notifications côté navigateur. **Compatibles** : rien de ce que l'app
  lit ou écrit n'a changé.
- **`0036`–`0040`, toutes appliquées** (2026-10-14 à 2026-10-20) :
  `0037` interdit l'écriture directe de « Mes informations » et de la
  boutique sans passer par `/api/app/*` ; **les versions de test
  construites avant `dev` (2026-10-09) ne peuvent plus les enregistrer**
  tant qu'elles ne sont pas remplacées. Retour arrière possible :
  ré-accorder l'`update` colonne par colonne retiré par `0037`.

## Décisions du porteur du projet

- L'app vit dans son propre dépôt depuis le 2026-10-07 ; toute
  modification d'une table, d'une politique RLS ou de `/api/app/*` reste
  compatible avec l'app installée (`CLAUDE.md`).
