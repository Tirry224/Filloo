# Savoir de relecteur-compat

Mémoire de l'agent `relecteur-compat`. État ACTUEL ; l'historique est
dans `git log`. Chaque entrée : date, source, constaté ou supposé.

## Ce qui rend l'app fragile

- **Pas d'`expo-updates`, pas de mise à jour forcée** (constaté
  2026-10-14, `app.json`) : un correctif de l'app passe par les stores,
  et les anciennes versions restent installées.
- **`src/lib/database.types.ts` de l'app est une copie à la main** de
  celui du site : il peut être en retard d'une migration.

## Versions de l'app en circulation

- 2026-10-14 : **aucune version publiée sur les stores** ; des versions
  de test circulent depuis le 2026-10-09 (README de l'app, « Où en est
  l'app »). Tant que c'est vrai, un changement cassant ne touche que des
  testeurs — à remplacer ici dès la première publication (numéro de
  version, date, commit de `main`).

## Ce dont l'app dépend (inventaire du 2026-10-14, commit `167f006`)

Point de départ seulement : **toujours recalculer par `grep`** dans
l'app, cette liste vieillit.

- **Routes du site** (sur `EXPO_PUBLIC_SITE_URL`) :
  `/api/app/message-envoye`, `/api/app/supprimer-compte`,
  `/api/app/mes-informations`, `/api/app/ma-boutique`.
- **RPC** : `search_products`, `conversation_is_open`,
  `enregistrer_telephone`.
- **Buckets** : `product-images`, `shop-photos`.
- **Realtime sur `messages`** (`main` et `dev` de l'app au 2026-10-14,
  `a852a51`/`14ea03a`, constaté) : `postgres_changes` `INSERT` filtré par
  `conversation_id` (`composants/EcranFil.tsx`) et `*` sans filtre
  (`lib/non-lus.ts`). **Retirer `messages` de `supabase_realtime` casse
  le direct et la pastille de ces versions.**
- **Canal privé `user:<auth.uid()>`** (branche `claude/traffic-capacity-app-site-grj36p`
  de l'app, `b13a3cf`, pas encore dans `dev`) : broadcast `message`
  diffusé par la base (`0038`), lu dans `src/lib/mes-messages.ts` ;
  champs lus : `op`, `conversation_id`, `sender_id` (+ `body` côté site).
- **Tables lues ou écrites en direct** : `profiles`, `merchants`,
  `products`, `product_images`, `conversations`, `messages`, `reports`,
  `expo_push_tokens`, `cities`, `categories`. Écritures directes
  notables : `products` (insert/update/delete), `product_images`
  (insert/upsert/delete), `conversations` (insert, `blocked_by`),
  `messages` (insert, `read_at`), `profiles` (insert, `city_id`),
  `merchants` (insert), `reports` (insert).

## Changements en attente à surveiller

- **`0036` et `0037`** (site, commitées, non appliquées au 2026-10-14) :
  `0037` interdit l'écriture directe sans mot de passe. L'app de `dev`
  passe désormais par `/api/app/mes-informations` et `/api/app/ma-boutique`
  (commit `167f006`) ; **`main` de l'app (les versions de test du
  2026-10-09) n'appelle aucune de ces deux routes** — constaté par
  `git grep` le 2026-10-14. Appliquer `0037` casse donc « Mes
  informations » et « Modifier ma boutique » sur les téléphones de test
  tant qu'ils n'ont pas reçu une version construite depuis `dev`.

- **`0038` (canal privé, commit site `f301e19`, non appliquée au
  2026-10-14)** : relue COMPATIBLE seule (garde la publication, erreurs
  de diffusion attrapées). Les clients site `d1211f0` et app `b13a3cf`
  EXIGENT `0038` : sans elle, plus de direct. Ordre sûr : appliquer
  `0038`, puis amener les clients. Le retrait de `messages` de la
  publication attend qu'aucune app installée n'écoute `postgres_changes`.
- realtime-js : site 2.116.0, app 2.117.3 ; `config.private` envoyé au
  join, broadcast livré tel quel `{ type, event, payload, meta? }`
  (constaté dans `dist/main/RealtimeChannel.js`, 2026-10-14).

## Décisions du porteur du projet

- L'app vit dans son propre dépôt depuis le 2026-10-07 ; toute
  modification d'une table, d'une politique RLS ou de
  `/api/app/message-envoye` doit rester compatible avec l'app installée
  (CLAUDE.md du site).
