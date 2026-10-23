# Architecture du site

Comment le code est rangé et où va la logique. Le produit est dans
`docs/SPEC.md`, les écrans dans `docs/ECRANS.md`.

Réécrit le 2026-10-23 pour décrire **le code tel qu'il est**. La version
précédente proposait un découpage par sections (`_sections/`, `query.ts`
par section) qui n'a jamais été appliqué ; elle se relit par
`git log -p -- docs/ARCHITECTURE.md`.

---

## 1. Deux espaces, une frontière de sécurité

Le premier critère de rangement est le **rôle**, pas l'habillage : un
client et un commerçant ne partagent jamais un écran, une barre de
navigation ni une route (décision 8 de `docs/SPEC.md`).

| Groupe de `src/app/` | Ce que c'est | Garde | Habillage |
|---|---|---|---|
| `(client)/(onglets)` | Destinations client : accueil, recherche, messages, compte, boutique publique. | Aucune : le catalogue est public ; `/compte` et `/messages` se gardent eux-mêmes. | `ClientNav` |
| `(client)/(plein-ecran)` | Ce qu'on ouvre depuis un écran client : fiche, fil, formulaires. | Idem | Chaque écran rend son cadre |
| `(vendeur)` | La frontière de l'espace commerçant. **Ne dessine rien.** | `requireMerchantSpace` dans `layout.tsx` | — |
| `(vendeur)/(onglets)` | Accueil, produits, messages, boutique. | héritée | `MerchantNav` |
| `(vendeur)/(plein-ecran)` | Formulaires et feuilles d'actions. | héritée | Chaque écran rend son cadre |
| racine | Authentification, `/suivi`, routes `api/` et `auth/`. | — | Chaque écran rend son cadre |

**Ce qui se partage se partage en composant, jamais en route.** Un fil de
discussion se dessine pareil des deux côtés : `ThreadScreen` est monté
par deux routes qui lui imposent chacune leur espace. Une route partagée
(`/messages?vue=commercant`, retirée) changeait d'espace au premier lien
qui oubliait le paramètre.

### Trois contrôles, qui ne font pas double emploi

| Où | Question |
|---|---|
| `src/middleware.ts` (bord) | Y a-t-il une session ? (lecture de cookie, aucune requête) |
| `(vendeur)/layout.tsx` (serveur) | Cette session a-t-elle un profil commerçant actif ? |
| RLS (base) | Cette requête a-t-elle le droit de lire ou d'écrire cette ligne ? |

Les deux premiers protègent le **parcours**, le RLS protège les
**données**. `npm run espaces` et `npm run gardes` vérifient que la
séparation tient ; ils sont faits pour échouer.

---

## 2. Où va la logique

| Dossier | Rôle | Règle |
|---|---|---|
| `src/app/**/page.tsx` | Lire l'URL, lire les données, composer l'écran. | Pas d'écriture. |
| `src/lib/data/` | **Lecture seule.** Seul endroit qui connaît la forme de la base, traduite vers `src/lib/types.ts`. | `catalogue-public.ts` : lectures en cache (une minute), toujours par le client anonyme. |
| `src/lib/actions/` | **Écritures** (actions serveur) : `auth`, `merchants`, `products`, `messages`, `account`, `push`. | Toute validation est refaite ici ; le navigateur n'est qu'un confort. |
| `src/lib/ecritures-protegees.ts` | Écritures exigeant le mot de passe (nom, téléphone, boutique), faites par le serveur pour le site ET l'app. | `0036`, `0037`. |
| `src/app/api/app/*` | API de l'app mobile. | **Compatible avec l'app déjà installée**, toujours. |
| `src/app/api/quotidien`, `api/notifications` | Cron du matin et envoi des notifications en attente. | `CRON_SECRET`. |
| `src/components/` | `ui/` sans aucune connaissance de Filloo ; `product/`, `chat/`, `auth/`, `nav/`, `push/`, `legal/` pour le domaine. | Un composant n'y monte qu'à son **deuxième** usage. |

### Les clients Supabase (`src/lib/supabase/`)

- `server.ts` — client de session, **un par requête** : un client global
  ferait partager une session à deux visiteurs.
- `public.ts` — client **anonyme**, pour ce que tout le monde voit pareil
  (catalogue en cache, sitemap). Un cache partagé ne porte jamais ce
  qu'une session voit.
- `admin.ts` — clé `service_role`, qui contourne le RLS : réservée à ce
  que la session ne peut pas faire (écritures protégées, suppression de
  compte, notifications, mesures, ménage, chiffres de `/suivi`). Chaque
  appel vérifie lui-même QUI demande.
- `client.ts`, `mes-messages.ts` — navigateur, pour le temps réel
  seulement ; chargés à la demande.

### Le passage au navigateur

`"use client"` se pose **le plus bas possible** : le bouton, le champ,
la cloche — jamais l'écran. Tout formulaire passe par `useFormulaire`
(`src/lib/use-formulaire.ts`), qui garde la saisie après une erreur,
survit à une coupure réseau et bloque le double envoi.

### L'état d'écran vit dans l'URL

Catégorie, tri, recherche : `/?categorie=…`, pas un `useState`. Un filtre
dans l'URL se partage par lien et se défait avec le bouton retour.

---

## 3. La largeur d'un écran

Un écran déclare une **forme**, jamais des pixels. La table `LARGEURS` de
`src/components/ui/Screen.tsx` est le seul endroit qui combine des
largeurs.

| Famille | Jusqu'à | Pour quoi |
|---|---|---|
| `colonne` | 640 px | Formulaires, textes, erreurs. |
| `rangees` | 768 px | Menus, listes de conversations et de produits du commerçant. |
| `grille` | 1152 px | Vignettes de produits ; seule famille pleine largeur. |

- `Screen` pour un écran plein écran, `TabScreen` pour un écran à onglets
  (`AppShell` porte déjà le fond et la hauteur).
- **Le centrage vit dans le conteneur, jamais dans l'écran**, et **aucune
  largeur chiffrée dans un composant** (`max-w-2xl` ne produit rien,
  `npm run classes` le signale).
- `npm run largeurs` ouvre chaque écran de 320 à 1920 px et signale tout
  débordement. Il ne voit que les débordements : le reste se regarde.

---

## 4. Conventions

- **Adresses en français** (vues et partagées sur WhatsApp), **code en
  anglais** pour les composants existants, **commentaires et documents en
  français**.
- **Les classes se déclarent dans une table de styles** en haut du
  fichier et n'emploient que les tokens nommés (`src/styles/README.md`,
  `src/components/README.md`).
- **Pas de couche `features/`, pas d'`index.ts` de ré-export, pas de
  bibliothèque de composants**, pas de gestionnaire d'état global.

## 5. Avant de considérer un écran comme fait

- [ ] `npm run typecheck`, `npm run build`, `npm run tests` passent.
- [ ] `npm run classes`, `npm run espaces`, `npm run gardes` passent.
- [ ] L'écran déclare sa famille de largeur.
- [ ] L'écran a été **regardé** dans un navigateur, au format téléphone.
