# Architecture du front-end — pages, sections, unités

Ce document décrit **comment le code de l'interface est rangé** et **où va la
logique**. Il ne décrit pas le produit (`docs/SPEC.md`) ni les écrans
(`docs/ECRANS.md`), mais la forme des fichiers qui les réalisent.

Il est écrit avant la refonte, pour être discuté sur papier plutôt que
découvert dans un diff de trente fichiers. **Rien de ce qui suit n'est encore
appliqué au code.**

Vérifié contre les documents livrés avec Next.js 16 dans
`node_modules/next/dist/docs/01-app/` — structure de projet, chargement des
données, mise en cache, mutations.

---

## 1. Le problème qu'on corrige

Aujourd'hui, une page est un seul fichier qui contient tout. `src/app/page.tsx`
tient en un bloc la barre de recherche, la rangée de catégories, le bloc
« À la une », la grille « Récents » et l'écran vide — et la carte « À la une »
y est écrite à la main, en JSX brut, au lieu d'être un composant.

Trois conséquences, toutes déjà visibles :

1. **Changer une section oblige à relire la page entière.** Rien n'indique où
   commence et où finit un morceau.
2. **Quand Supabase arrivera, toutes les requêtes de la page se retrouveront en
   haut du même fichier.** La page deviendra un chargeur de données géant, et
   la partie la plus lente bloquera l'affichage de toutes les autres.
3. **Rien ne se réutilise sans copier-coller**, parce que rien n'a de nom ni de
   frontière.

La règle qui suit répond à ces trois points : **chaque morceau porte son propre
poids** — son affichage, ses données, ses actions.

---

## 2. Les quatre niveaux, et rien de plus

| Niveau | Ce que c'est | Ce qu'il a le droit de faire |
|---|---|---|
| **Page** | Une adresse (`/produit/42`) | Lire l'URL, déclarer ses sections, rien d'autre |
| **Section** | Un bloc visible et nommable d'un écran (« À la une », « Photos du produit », « Saisie du message ») | Aller chercher **ses** données, déclencher **ses** actions |
| **Unité** | Un morceau de section (une carte, une ligne, un champ) | Afficher ce qu'on lui passe, gérer son état local |
| **Sous-unité** | Un détail d'unité (un badge de prix, une pastille) | Afficher, point |

**Quatre niveaux, c'est la limite.** Au-delà, le composant n'est plus un détail
d'écran : c'est une brique partagée, et sa place est dans `src/components/`
(§7).

La ligne la plus importante de ce tableau est celle des **unités** : une unité
ne parle **jamais** à Supabase. La descente vers la base s'arrête au niveau de
la section. C'est ce qui garde les unités testables, réutilisables, et
affichables telles quelles dans `/styleguide`.

---

## 3. Deux espaces, puis deux habillages

Le découpage se fait par **groupes de routes** — des dossiers entre
parenthèses, qui regroupent des pages sous un layout commun **sans apparaître
dans l'adresse**. `(client)/(onglets)/page.tsx` répond toujours à `/`.

Ce document décrivait auparavant un découpage par HABILLAGE
(`(principal)`, `(secondaire)`, `(flux)`, `(etat)`). L'intention était juste —
« la barre est déclarée une fois par groupe, l'oublier devient impossible » —
mais il n'a jamais été implémenté : les 38 fichiers de page sont restés à
plat pendant tout le développement, chaque écran rendant sa propre barre.
Le résultat était exactement celui que ce paragraphe promettait d'éviter, en
pire : la barre se choisissait par une prop `space` dont la valeur par défaut
était « client », donc tout écran qui l'oubliait servait silencieusement la
navigation de l'autre espace.

**Le premier critère de découpage est le RÔLE, pas l'habillage.** C'est la
correction du 2026-09-16, et la raison tient en une phrase : l'habillage est
une question de confort, le rôle est une frontière de sécurité. Un groupe qui
sépare « pages principales » de « pages secondaires » ne donne aucun endroit
où écrire « personne n'entre ici sans profil commerçant ». Un groupe par
espace, si.

| Groupe | Ce que c'est | Garde | Habillage |
|---|---|---|---|
| `(client)/(onglets)` | Destinations client : on y arrive sans venir de nulle part. | Aucune — le catalogue est **public** | `Screen` + `ClientNav` |
| `(client)/(plein-ecran)` | Ce qu'on ouvre **depuis** un écran client, et d'où l'on revient. | Aucune ; `/compte` et `/messages` se gardent eux-mêmes | Chaque écran rend son cadre |
| `(vendeur)` | La frontière de l'espace commerçant. **Ne dessine rien.** | `requireMerchantSpace` | — |
| `(vendeur)/(onglets)` | Les quatre destinations commerçant : Accueil, Produits, Messages, Boutique. | héritée | `Screen` + `MerchantNav` |
| `(vendeur)/(plein-ecran)` | Feuilles d'actions et formulaires — produit, fil, édition de la boutique : on les ouvre par-dessus, on les ferme. | héritée | Chaque écran rend son cadre |
| racine | Authentification et atelier — ni client, ni commerçant. | — | Chaque écran rend son cadre |

```
src/app/
  layout.tsx                          ← racine : polices, tokens, <html lang="fr">
  connexion/ inscription/ …           ← authentification : aucun espace
  (client)/
    (onglets)/
      layout.tsx                      ← Screen + ClientNav
      page.tsx                        → /
      recherche/page.tsx              → /recherche
      messages/page.tsx               → /messages
      compte/page.tsx                 → /compte
      boutique/[id]/page.tsx          → /boutique/7
    (plein-ecran)/
      produit/[id]/page.tsx           → /produit/42
      messages/[id]/page.tsx          → /messages/xxx
  (vendeur)/
    layout.tsx                        ← LA GARDE : requireMerchantSpace
    (onglets)/
      layout.tsx                      ← Screen + MerchantNav (4 onglets)
      vendeur/page.tsx                → /vendeur          · Accueil
      vendeur/produits/page.tsx       → /vendeur/produits · Produits
      vendeur/messages/page.tsx       → /vendeur/messages · Messages
      vendeur/boutique/page.tsx       → /vendeur/boutique · Boutique
    (plein-ecran)/
      vendeur/produits/nouveau/…      → formulaires produit
      vendeur/produits/[id]/…         → modifier, feuille d'actions
      vendeur/boutique/modifier/…     → l'édition, séparée de sa lecture
      vendeur/messages/[id]/…         → le fil et ses trois feuilles
```

### Ce qui se partage, et ce qui ne se partage pas

Un fil de discussion se dessine **pareil des deux côtés**. Le dupliquer
créerait deux versions qui divergeraient au premier correctif. Il vit donc
dans `src/components/chat/ThreadScreen.tsx`, monté par **deux routes
distinctes** qui lui imposent chacune leur espace :

```tsx
// (vendeur)/(plein-ecran)/vendeur/messages/[id]/page.tsx
return <ThreadScreen espace="merchant" {...props} />;
```

La règle générale : **ce qui se partage se partage en composant, jamais en
route.** Une route partagée est une route ambiguë, et c'est exactement ce
qu'était `/messages?vue=commercant` — un chemin qui rendait deux écrans
différents selon une query string, donc un espace qui changeait sous les
pieds de la personne au premier lien qui oubliait le paramètre.

### Les trois contrôles, et pourquoi ils ne font pas double emploi

| Où | Question | Coût |
|---|---|---|
| `src/middleware.ts` (bord) | Y a-t-il une session ? | Lecture de cookie, aucune requête |
| `(vendeur)/layout.tsx` (serveur) | Cette session a-t-elle un profil commerçant actif ? | Une requête, une seule fois |
| RLS (base) | Cette requête a-t-elle le droit de lire cette ligne ? | — |

Les deux premiers protègent le **parcours**, le troisième protège les
**données**. Aucun ne remplace les autres : sans le RLS, un appel direct à
l'API Supabase contourne tout ; sans le layout, un client authentifié atteint
la feuille d'actions d'un produit — vide grâce au RLS, mais habillée en
commerçant.

`npm run espaces` vérifie que cette séparation tient, et il est fait pour
échouer : retirer la garde du layout, importer la barre de l'autre espace,
réintroduire `?vue=`, ou monter un composant de fil sans sa garde d'espace
le font sortir en code 1. Chacune de ses huit règles a été éprouvée par
mutation — cassée volontairement pour vérifier qu'elle échoue.

`npm run gardes` complète le tableau par l'autre bout : une table de
vérité de treize cas — anonyme, client seul, commerçant seul, comptes
liés, chaque cas suspendu — qui dit pour chacun s'il entre et, sinon, où
il part. Elle exerce `src/lib/data/espace-decision.ts`, où la DÉCISION est
isolée de la base et de `redirect()` précisément pour être testable sans
l'une ni l'autre.

---

## 4. L'anatomie d'une page

Tout ce qui appartient à une page vit **dans le dossier de cette page**, dans
un sous-dossier préfixé d'un tiret bas. Next garantit qu'un dossier `_xxx`
n'est jamais une adresse : rien de ce qui s'y trouve ne devient une page par
accident.

```
src/app/(principal)/
  page.tsx                      ← le fil d'accueil, ~35 lignes
  _sections/
    SearchEntry/
      index.tsx                 ← la section
      CategoryRow.tsx           ← une unité
    FeaturedProduct/
      index.tsx
      FeaturedCard.tsx
      query.ts                  ← ses lectures
      skeleton.tsx              ← son attente
    RecentGrid/
      index.tsx
      query.ts
      skeleton.tsx
  _components/                  ← partagé entre DEUX sections de cette page
```

### Le vocabulaire des fichiers, toujours le même

| Fichier | Rôle | Obligatoire ? |
|---|---|---|
| `index.tsx` | La section elle-même. Composant serveur. | Oui |
| `query.ts` | Ses lectures Supabase. Commence par `import "server-only"`. | Si elle lit des données |
| `actions.ts` | Ses écritures. Commence par `"use server"`. | Si elle modifie des données |
| `skeleton.tsx` | Ce qui s'affiche pendant son chargement. | Si elle a un `query.ts` |
| `NomDUnite.tsx` | Une unité. | Selon besoin |

Ces cinq noms ne changent jamais. On ouvre n'importe quelle section du projet
et on sait déjà où regarder — c'est le seul bénéfice recherché, et il suffit.

---

## 5. La règle centrale : chaque section va chercher ses données

Une page **ne charge rien pour ses enfants**. Elle lit l'URL, en extrait les
critères (une ville, un identifiant), et les passe aux sections. Chaque section
appelle Supabase pour elle-même, enveloppée dans un `<Suspense>` avec son
propre squelette.

```tsx
// src/app/(principal)/page.tsx
import { Suspense } from "react";
import { ScreenBody } from "@/components/ui/Screen";
import { SearchEntry } from "./_sections/SearchEntry";
import { FeaturedProduct } from "./_sections/FeaturedProduct";
import { FeaturedSkeleton } from "./_sections/FeaturedProduct/skeleton";
import { RecentGrid } from "./_sections/RecentGrid";
import { RecentGridSkeleton } from "./_sections/RecentGrid/skeleton";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ville?: string }>;
}) {
  const { ville = "Conakry" } = await searchParams;

  return (
    <ScreenBody>
      <SearchEntry />
      <Suspense fallback={<FeaturedSkeleton />}>
        <FeaturedProduct city={ville} />
      </Suspense>
      <Suspense fallback={<RecentGridSkeleton />}>
        <RecentGrid city={ville} />
      </Suspense>
    </ScreenBody>
  );
}
```

```tsx
// src/app/(principal)/_sections/RecentGrid/index.tsx
import { ProductCard } from "@/components/product/ProductCard";
import { Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getRecentProducts } from "./query";
import { RecentGridEmpty } from "./RecentGridEmpty";

export async function RecentGrid({ city }: { city: string }) {
  const products = await getRecentProducts(city);
  if (products.length === 0) return <RecentGridEmpty city={city} />;

  return (
    <Section className="gap-2 pt-3.5">
      <SectionLabel>Récents</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </Section>
  );
}
```

Ce que cette forme achète, et qui n'est pas cosmétique :

- **Une section lente n'empêche plus les autres de s'afficher.** Le fil
  apparaît pendant que « À la une » charge encore. Sur une connexion mobile
  guinéenne, c'est la différence entre une page utilisable et un écran blanc.
- **Déplacer une section d'une page à l'autre est un déplacement de dossier.**
  Elle emporte ses requêtes avec elle. Aucune ligne à retrouver dans le fichier
  de la page.
- **Supprimer une section supprime ses requêtes.** Pas de requête orpheline qui
  continue de coûter une lecture pour un affichage disparu.

### Ce que la page a le droit de faire, et rien de plus

| Autorisé dans `page.tsx` | Interdit dans `page.tsx` |
|---|---|
| Lire `params` et `searchParams` | Appeler Supabase |
| Déclarer `generateMetadata` | Écrire du JSX autre que la disposition des sections |
| Ordonner les sections et leurs `<Suspense>` | Contenir une condition métier |
| Appeler `notFound()` si l'identifiant n'existe pas | Dépasser une cinquantaine de lignes |

La seule exception à « la page n'appelle pas Supabase » : **vérifier
l'existence**. `/produit/999` doit répondre 404 avant d'afficher trois
squelettes pour rien. Cette unique lecture, partagée avec les sections par la
mémoïsation de React (`cache()`), reste dans la page.

### Mise en cache

Next 16 ne met plus rien en cache par défaut : une lecture non cachée bloque le
rendu jusqu'à sa réponse. Deux outils, à choisir par section :

- **`<Suspense>`** — ci-dessus — pour tout ce qui doit être frais à chaque
  visite : le fil, les messages, la disponibilité d'un produit.
- **`use cache` + `cacheLife`** dans `query.ts` pour ce qui bouge rarement :
  les catégories, les villes, la fiche d'une boutique. Cela suppose d'activer
  `cacheComponents: true` dans `next.config.ts` — décision à prendre au moment
  de brancher Supabase, pas maintenant.

Une fonction qui lit les cookies, les en-têtes ou `searchParams` ne peut pas
porter un simple `use cache`. C'est une raison de plus pour que les critères
descendent **en paramètres** depuis la page, au lieu d'être lus au fond de
l'arbre.

---

## 6. Où va le reste de la logique

### Les écritures : `actions.ts`, dans la section qui porte le bouton

Le fichier `actions.ts` d'une section commence par `"use server"`. La section
qui affiche le bouton « Marquer vendu » est celle qui contient l'action
`markAsSold`. Après l'écriture, elle appelle `revalidatePath` ou
`revalidateTag` pour rafraîchir ce qu'elle vient de changer.

**Toute validation est refaite dans l'action.** Ce qu'un formulaire vérifie
côté navigateur est du confort d'affichage ; ce qu'une Server Action vérifie
est la seule barrière réelle. Et sous elle, le RLS de Supabase reste la
dernière — `supabase/migrations/0002_rules_and_security.sql` est ce qui protège
vraiment les données, pas le code React.

### Le passage au navigateur : sur l'unité, jamais sur la section

`"use client"` se pose **le plus bas possible**. Dans un formulaire, ce n'est
pas le formulaire qui devient client : c'est le bouton d'envoi qui affiche
l'état « en cours » via `useActionState`. Dans le fil de discussion, ce n'est
pas le fil : c'est le champ de saisie.

Une section `index.tsx` ne porte jamais `"use client"`. Si elle semble en avoir
besoin, c'est qu'une unité manque.

### L'état d'écran : dans l'URL

Déjà appliqué et conservé : le filtre de ville est `/?ville=Boké`, pas un
`useState`. Un filtre dans l'URL se partage par lien, se défait avec le bouton
retour du téléphone, et rend l'écran vide réellement atteignable. Aucun état
d'écran ne redescend dans un `useState` sans raison écrite.

### Les états vides

L'état vide appartient à **la section**, pas à la page. C'est
`RecentGrid/index.tsx` qui décide quoi afficher quand il n'y a aucun produit —
c'est elle, et elle seule, qui sait qu'il n'y en a pas. Aujourd'hui ce choix
est un grand ternaire au milieu de la page, qui enveloppe deux sections dans
une seule condition.

---

## 7. Quand un morceau sort de son dossier

Une seule règle, appliquée sans discussion :

| Utilisé par | Vit dans |
|---|---|
| Une seule section | Le dossier de la section |
| Deux sections de la même page | `_components/` de la page |
| Deux pages d'un même groupe | `_components/` du groupe |
| Deux groupes | `src/components/` |

La promotion se fait **au deuxième usage, pas au premier** — règle déjà en
vigueur dans `src/components/README.md`, elle ne change pas. On ne promeut pas
« au cas où » : un dossier partagé rempli de composants à usage unique coûte
plus cher à lire qu'un peu de duplication assumée.

La frontière de `src/components/` reste celle d'aujourd'hui :

- `ui/` — aucune connaissance de Makiti. `Button`, `Card`, `Field`. Un
  composant de `ui/` qui importe un type du domaine est un bug de rangement.
- `product/`, `chat/` — le domaine.

Quel que soit le niveau — section, unité ou composant partagé — **les classes
se déclarent dans une table de styles en haut du fichier**, jamais semées dans
le JSX, et elles n'emploient que le vocabulaire nommé des tokens (`gap-snug`,
`px-gutter`, `size-mark`). Cette convention et ses exceptions sont décrites
dans `src/components/README.md` et `src/styles/README.md`.

L'accès aux données, lui, se centralise ailleurs :

```
src/lib/supabase/
  server.ts     ← client serveur (cookies, session)
  client.ts     ← client navigateur, pour le temps réel uniquement
src/lib/types.ts  ← généré par `supabase gen types typescript`
```

Les `query.ts` des sections importent depuis `src/lib/supabase/server.ts`. La
clé `service_role` n'entre dans aucun de ces fichiers.

---

## 8. Nommage

- **Les adresses sont en français**, parce qu'elles sont vues par l'utilisateur
  et partagées sur WhatsApp : `/recherche`, `/produit/42`, `/inscription`.
- **Les identifiants du code sont en anglais**, par cohérence avec les 24
  composants qui existent déjà (`ProductCard`, `EmptyState`, `ThreadRow`).
  Renommer l'existant en français coûterait une passe complète sans rien
  apporter au produit.
- **Les commentaires et la documentation restent en français**, comme
  aujourd'hui.

C'est un choix de cohérence, pas une conviction : si tu préfères des noms de
sections en français (`ALaUne`, `GrilleRecents`), c'est le moment de le dire —
la refonte touchera de toute façon tous ces fichiers.

Les dossiers de section portent un **nom de bloc, pas un nom de composant** :
`FeaturedProduct`, pas `FeaturedProductSection`. Le dossier `_sections/` dit
déjà que c'en est une.

---

## 9. Ce qu'on ne fait pas

| Tentation | Pourquoi non |
|---|---|
| Une couche `src/features/` en plus des routes | Deux endroits où chercher la même chose. La route **est** la feature. |
| Un `index.ts` de ré-export par dossier | Des imports plus courts, des chemins plus flous, et un piège à imports circulaires. |
| Un `types.ts` par section | Les types du domaine viennent de Supabase. Une section n'invente pas ses propres formes. |
| Découper une section qui tient en 30 lignes | Le critère est la lisibilité, pas le comptage. Trois fichiers de dix lignes se lisent moins bien qu'un de trente. |
| `"use client"` sur une page « pour aller plus vite » | On perd le rendu serveur des fiches produit — donc Google et l'aperçu WhatsApp, qui sont deux canaux d'acquisition gratuits. |

---

## 10. La liste de contrôle

Avant de considérer un écran comme fait :

- [ ] `page.tsx` ne contient que des sections et leurs `<Suspense>`
- [ ] Aucun appel Supabase dans `page.tsx`, hors vérification d'existence
- [ ] Chaque section qui lit des données a son `query.ts` et son `skeleton.tsx`
- [ ] Aucune unité n'importe `@/lib/supabase`
- [ ] `"use client"` n'apparaît sur aucun `index.tsx` de section
- [ ] Chaque section gère elle-même son cas vide
- [ ] Aucun composant à usage unique n'a été promu dans `src/components/`
- [ ] `npm run typecheck` et `npm run build` passent
- [ ] L'écran a été **regardé dans un navigateur** — une classe Tailwind
      inexistante ne produit aucune erreur

---

## 11. Ordre de migration

**L'étape 1 est faite depuis le 2026-09-16** — et elle a été faite pour
une raison qui n'était pas celle prévue ici. Ce document la présentait
comme un rangement ; c'est une demande de séparation des espaces
client/commerçant qui l'a déclenchée, parce qu'aucune des deux barres de
navigation n'avait d'endroit où vivre. Un rangement qu'on repousse
indéfiniment finit par être imposé par un défaut.

Les étapes 2 et suivantes restent des propositions, non engagées.

1. ~~**Les groupes de routes et leurs layouts.**~~ **Fait.** Déplacement
   de fichiers, sans changement d'adresse sauf `/vendeur/messages`. La
   barre du bas est remontée dans les layouts `(onglets)` ; `TopBar`, lui,
   est resté dans les pages — chacune a son titre, son bouton d'action et
   parfois sa flèche retour, donc il n'y avait rien à factoriser.
2. **Le fil d'accueil** — la page la plus mal découpée, et celle qui sert de
   modèle aux autres.
3. **La fiche produit** — le premier écran à sections vraiment indépendantes :
   galerie, prix, boutique, actions, produits similaires.
4. **Le fil de discussion** — le premier écran avec une frontière client : la
   saisie du message.
5. **Les 30 autres**, par groupe, dans l'ordre `(principal)`, `(secondaire)`,
   `(flux)`, `(etat)`.
6. **`src/lib/mock.ts` disparaît** au fur et à mesure que les `query.ts`
   appellent Supabase. Chaque section bascule seule : c'est le principal
   bénéfice de ce découpage pour la suite du projet.

Les étapes 1 à 4 se relisent en une fois. À partir de la 5, c'est de la
répétition mécanique.

---

## 12. Ce que ce document ne change pas

La pile est déjà celle qui est visée : **Next.js 16, React 19, TypeScript,
Tailwind 4, Supabase, Vercel**. Les 35 écrans existent. Les migrations SQL et
leurs 34 tests de sécurité existent. Les tokens de `src/styles/` et la
direction visuelle « A — Marché » ne bougent pas. Les fichiers de `design/`
restent ce qu'ils sont : la maquette source, jamais du code exécuté.

Ce document ne réorganise que la manière dont l'interface est découpée — et il
le fait maintenant, avant que les requêtes Supabase ne viennent s'ajouter à des
pages déjà trop pleines.
