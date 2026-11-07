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

- **2026-10-23, `/api/app/supprimer-compte`** : accepte un `role`
  facultatif (`client` ou `merchant`) qui ne supprime que ce compte ;
  réponse `{ supprime, connexionFermee }`. **Sans `role`, comportement
  inchangé** (tout supprimer, `{ supprime: true }`) : compatible avec
  l'app installée. Aucune table ni policy modifiée. Côté site, les
  profils `is_deleted` ne sont plus lus par `getMyProfiles`.

- **2026-10-23, routes `/api/app/*` qui vérifient le mot de passe**
  (`requete-app.ts`, `supprimer-compte`) : 403 seulement pour un mot de
  passe faux (inchangé) ; « trop d'essais » répond désormais 429 et une
  panne 503, avec un `message` en français. Avant, les deux répondaient
  403 « mot de passe incorrect ». Une app installée traite 429/503 comme
  une erreur générique : compatible.

- **2026-11-06, `0046` (modération de l'équipe, NON appliquée)** : relue
  côté serveur seulement, **code de l'app inaccessible** (voir
  « Accès »). Que des ajouts ; les policies réécrites sont reprises à
  l'identique de `0002` (`reports: je signale`) et `0041` (`profiles: je
  cree mon second compte`) plus une condition `is null` sur une colonne
  neuve. Seul vrai risque : un `update` de `products` (ou de `profiles`)
  qui renverrait la ligne LUE entière (`...produit`) contiendrait
  `masque_par_equipe` (ou `suspension_reason`), hors liste blanche
  `update` (`0002`) → « permission denied » à chaque enregistrement. À
  vérifier par `grep -rn "update(" src/` dans l'app avant application
  (supposé absent, non constaté).

## Accès au code de l'app

- **2026-11-07 (constaté)** : app clonée dans `/home/user/Filloo-mobile`
  (session sur une branche `claude/…` = `main`). `main` = `bfbc1cb`
  (2026-11-03), `dev` = `1f7cacc` (+11 commits), lu par
  `git fetch origin dev` puis `git grep FETCH_HEAD`. Le 2026-11-06,
  l'accès avait été refusé (MCP GitHub limité à `tirry224/filloo`).

## Équipe Filloo dans l'app (constaté 2026-11-07, `git grep`)

- **`main` n'a AUCUN écran équipe** : ni `fil_equipe` ni `annonces` ;
  une notification d'équipe (`/compte/equipe/...`) ouvre l'accueil
  (`ouvrir()` de `src/lib/notifications.ts`).
- **`dev` a `src/app/equipe.tsx` + `src/lib/equipe.ts`** : lit
  `annonces`, `fil_equipe` (`id, de_l_equipe, corps, created_at,
  annonces(titre)`, filtre `fil_de` + `espace`), compte
  `annonce_destinataires.lue_at` et `fil_equipe.lu_at`, RPC
  `marquer_annonces_lues`, `marquer_fil_equipe_lu`, insère dans
  `fil_equipe`, appelle `POST /api/app/message-equipe`. `ouvrir()`
  route `/(compte|vendeur)/equipe(/discussion|/(reponse|annonce)/uuid)?`
  et `/equipe` vers `/equipe?espace=…`. Un fil ouvert par l'équipe
  s'affiche normalement (aucune hypothèse sur l'auteur du 1er message).
- **Ne jamais changer** ces chemins de notification ni ces colonnes sans
  garder l'ancien format tant qu'une version `dev` est installée.

## Suppressions par l'équipe (0067, relu 2026-11-07)

- Produit supprimé : l'écran vendeur dit « Produit introuvable » à la
  réouverture ; un enregistrement en cours répond « ce produit n'est pas
  le vôtre… » (0 ligne, `edition-produit.ts`) ; côté client, citer le
  produit → « Ce produit n'appartient pas à cette boutique. »
  (`check_message_product`, 0002). Gênant, pas cassant.
- Compte supprimé (`supprimerProfil`) : `lireComptes` filtre
  `is_deleted`, le fil passe en lecture seule (`conversation_is_open`).
  Le jeton reste valable jusqu'à son expiration (supposé ~1 h) ; le
  rafraîchissement d'un banni échoue (supposé : retour déconnecté).

## Décisions du porteur du projet

- L'app vit dans son propre dépôt depuis le 2026-10-07 ; toute
  modification d'une table, d'une politique RLS ou de `/api/app/*` reste
  compatible avec l'app installée (`CLAUDE.md`).
