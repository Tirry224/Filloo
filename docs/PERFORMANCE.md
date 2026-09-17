# Makiti — tenir sur une mauvaise connexion

Contrainte n°1 du projet, au même rang que « ça marche » : l'application doit
rester utilisable sur un réseau lent, instable et **facturé au mégaoctet**.
Ce document dit ce que ça coûte aujourd'hui, ce qu'on s'autorise, et ce que
ça interdit.

Règle de lecture : un budget qu'on ne mesure pas est un vœu.
`npm run build && npm run poids` donne les chiffres ci-dessous et **échoue**
si un budget est dépassé.

---

## 1. Ce que l'application pèse aujourd'hui

Mesuré le 10 septembre 2026, en gzip. Vercel sert en brotli, qui retire
encore 15 à 20 % : les chiffres réels sont un peu meilleurs.

| Poste | Poids | Payé quand ? |
|---|---|---|
| JavaScript + CSS (socle) | **169 Ko** | Première visite seulement, ensuite en cache |
| Police (1 fichier woff2) | **19,7 Ko** | Première visite seulement |
| HTML d'une page | 4 à 7 Ko | **À chaque navigation** |
| Photos | 0 Ko | **À chaque écran**, dès qu'elles existeront |

**Le chiffre qui doit choquer : 169 Ko de JavaScript pour une application où
rien n'est encore interactif.** Ce n'est pas du gaspillage de notre part,
c'est le prix d'entrée de Next et React : le navigateur télécharge de quoi
« réanimer » la page même quand il n'y a rien à réanimer.

Sur une connexion à 50 kbit/s effectifs, ces 235 Ko font environ **40 secondes
d'attente à la première visite**. C'est le pire moment de l'expérience, et
c'est celui qu'on ne peut pas beaucoup réduire sans changer d'outil (§6).

Les visites suivantes sont une autre histoire : le socle est en cache, il ne
reste que le HTML et les photos. **C'est là que se joue la facture de données
de tes utilisateurs**, et là que nos décisions comptent vraiment.

## 2. Budgets

| Budget | Valeur | Vérifié par |
|---|---|---|
| Socle JS + CSS | ≤ 200 Ko gzip | `npm run poids` |
| Polices préchargées | ≤ 40 Ko | `npm run poids` — 19,7 Ko, tenu |
| HTML d'une page | ≤ 12 Ko gzip | `npm run poids` |
| Vignette produit | ≤ 15 Ko | à la revue |
| Photo pleine taille | ≤ 120 Ko | à la revue |
| Un écran de fil complet | ≤ 250 Ko, photos comprises | à la revue |
| Tout écran doit marcher sans JavaScript | oui | `npm run parcours` |

## 3. Les règles, par ordre d'impact décroissant

### R1 — Les photos sont le poste n°1, tout le reste est secondaire

**Mesuré le 11 septembre 2026**, sur une photo de 4000 × 3000 (ce que
produit n'importe quel téléphone) : **2 920 Ko à l'origine, 185 Ko envoyés**
après redimensionnement à 1080 px et réencodage WebP dans le navigateur.
Le commerçant voit le chiffre à l'écran : sur un forfait au mégaoctet, ce
n'est pas un détail technique, c'est de l'argent.

Un fil de 24 produits, c'est 24 vignettes. À 25 Ko la vignette : **600 Ko**.
À 8 Ko : **190 Ko**. Le même écran, trois fois moins cher, pour une différence
que personne ne voit sur un téléphone.

- **Compression sur l'appareil du commerçant, avant l'envoi.** Une photo de
  téléphone fait 3 à 6 Mo ; l'envoyer telle quelle coûte cher au commerçant et
  se paie ensuite à chaque affichage.
- **Deux tailles stockées, générées au téléversement** : une vignette
  (largeur 400 px, qualité 60) et une photo d'écran (largeur 1080 px,
  qualité 70). Pas de redimensionnement à la volée côté serveur : la
  transformation d'images de Supabase est une option payante, et on la
  paierait à chaque affichage au lieu d'une fois au téléversement.
- **Format WebP**, avec la photo d'origine en repli. AVIF compresse encore
  mieux mais coûte du temps de calcul sur des téléphones d'entrée de gamme.
- **`loading="lazy"` sous la ligne de flottaison**, et des dimensions écrites
  en dur : une image sans dimensions fait sauter la page quand elle arrive.
- **Jamais de photo décorative.** Aucune bannière, aucune illustration
  d'ambiance. Les seuls octets d'image du projet sont des produits.

### R2 — Ne pas précharger ce qui ne sera pas lu

Next précharge par défaut les liens visibles à l'écran. Sur un fil de 24
produits, c'est **24 fiches téléchargées pour une seule qui sera ouverte**.
Confortable sur la fibre, ruineux sur un forfait à la journée.

Règle : `prefetch={false}` sur tous les liens de liste (fil, recherche,
boutique, messages). Le préchargement reste acceptable sur un lien unique et
très probable — le bouton « Contacter » d'une fiche produit, par exemple.

### R3 — Le JavaScript se juge au gramme, pas au principe

Le socle de 169 Ko est en cache après la première visite. Il ne grossit que
si on le laisse grossir — mais **« pas de JavaScript » n'est pas la règle**.
La règle est : *chaque kilo-octet doit rendre plus qu'il ne coûte.*

Un composant client est **justifié** quand il fait l'une de ces trois
choses, et qu'on peut le montrer :

| Il fait quoi | Exemple dans le projet | Ce que ça rapporte |
|---|---|---|
| Il économise beaucoup plus d'octets qu'il n'en pèse | `ChoixPhotos` : compression avant envoi | **2 920 Ko → 185 Ko** sur une photo, soit 94 % |
| Il donne une information que le serveur n'a pas | `BandeauReseau` : l'état de la connexion | Évite de croire l'application cassée |
| Il évite un aller-retour réseau | `RecherchesRecentes` (`localStorage`), contraintes natives des formulaires | Zéro requête pour une faute de frappe |

Il est **injustifié** quand il ne fait que déplacer du travail que le
serveur faisait déjà bien : refaire un `<select>`, animer une transition,
maintenir un état que l'URL portait très bien.

Le reste des garde-fous tient toujours :

- **Le défaut reste le composant serveur**, parce que c'est ce qui coûte
  zéro. On s'en écarte avec une raison, pas avec une habitude — et la
  raison s'écrit dans le fichier.
- **Aucune bibliothèque de composants** (pas de MUI, pas de shadcn en bloc) :
  le design system maison existe déjà et pèse ce que pèse son HTML.
- **Aucun gestionnaire d'état global**, aucun carrousel, aucune bibliothèque
  d'animation, aucun client de données côté navigateur.
- **Les icônes une par une** (`import { X } from "lucide-react"`), jamais le
  paquet entier.
- Les formulaires passent par les **Server Actions** : ils fonctionnent même
  si le JavaScript n'a pas fini de charger, ce qui est exactement le cas sur
  un réseau lent.

### R4 — Une seule police, décidé

Le projet en chargeait deux : Figtree pour le texte, Bricolage Grotesque pour
les titres — 60 Ko, dont 40 pour les seuls titres. Bricolage est retirée :
les titres gardent leur présence par la graisse et l'interlettrage. **19,7 Ko
aujourd'hui.** Ajouter une police redevient une décision, pas un réflexe.

### R5 — Les données : demander peu, et une seule fois

- **Pagination courte.** 24 produits par écran aujourd'hui ; 12 suffiraient
  sur un écran de téléphone, avec un bouton « Voir plus ». À trancher.
- **Pas de temps réel permanent.** Supabase Realtime tient une connexion
  ouverte : batterie et données consommées en continu pour un usage où un
  message toutes les heures suffit. On rafraîchit à l'ouverture de l'écran.
- **Pas de sondage automatique** en arrière-plan, jamais.
- La recherche n'interroge le serveur **qu'à la validation**, pas à chaque
  frappe : une recherche à la frappe, c'est huit requêtes pour un mot.

### R7 — Pas de frontière `loading.tsx` (pour l'instant)

Une frontière de chargement envoie d'abord un squelette, puis le contenu —
et c'est le **JavaScript du navigateur** qui remplace l'un par l'autre.
Sans lui, la page reste un squelette pour toujours.

Ce n'est pas une hypothèse : le projet avait un `loading.tsx` à la racine,
et **cinq écrans sur sept ne montraient jamais leur contenu** sans
JavaScript — le fil d'accueil compris. Personne ne l'avait vu parce que
personne n'avait testé sans JavaScript. Les deux frontières sont retirées ;
`scripts/parcours.mjs` teste désormais chaque parcours dans les deux
conditions.

Le composant `Skeleton` reste utilisable DANS une page, pour un bloc que
l'on remplit réellement plus tard. C'est la frontière de route qui est
écartée tant que les pages répondent vite.

**Ce qui rouvrirait la question :** quand les pages liront Supabase, une
requête lente rendra l'attente visible. Une frontière de chargement devient
alors payante *pour les visiteurs déjà chargés* — mais il faudra vérifier
qu'un visiteur sans JavaScript reçoit toujours le contenu, pas le squelette.
À remesurer avec `npm run parcours` ce jour-là, pas à décider par principe.

### R8 — Les contraintes de formulaire d'abord dans le navigateur

`required`, `minLength`, `pattern`, `type="email"` : le navigateur refuse
d'envoyer un formulaire fautif. La faute de frappe ne coûte alors **aucun
aller-retour réseau**, le message s'affiche instantanément, dans la langue
du téléphone, et les champs déjà remplis ne sont pas perdus — notamment le
mot de passe, qui ne revient jamais du serveur.

Le serveur revalide tout, sans exception : ces attributs se contournent en
trois secondes. Ils sont un confort pour l'utilisateur, jamais une
sécurité.

### R6 — Le réseau tombe : ce n'est pas une erreur, c'est un état normal

- Toute page doit rester lisible si une image n'arrive pas.
- L'**écran 4 (fil hors ligne)**, maquetté mais jamais codé, devient
  prioritaire : il montre les produits déjà consultés.
- Un service worker qui garde la coquille de l'application et les fiches
  déjà vues est le meilleur gain pour les visites répétées. Reporté après le
  branchement Supabase : c'est un vrai chantier, et il ne sert à rien tant
  qu'il n'y a pas de vraies données.

## 4. Ce que ces règles interdisent

Écrit noir sur blanc pour ne pas rediscuter à chaque envie :

vidéo · bannières et illustrations · polices supplémentaires · bibliothèque
de composants · animations au défilement · carrousels · temps réel permanent ·
recherche à la frappe · pages qui chargent puis re-chargent · publicité ·
outils d'analyse tiers · cartes interactives.

## 5. Décisions prises

1. **Une seule police** (Figtree). −40 Ko. Voir R4.
2. **12 produits par écran** et un bouton « Voir plus » qui en demande douze
   de plus, plafonné à 60. Constante `PAR_ECRAN` dans `src/lib/mock.ts`.
   Douze, c'est déjà six lignes de défilement ; au-delà on fait payer des
   vignettes que personne ne regarde.
3. **Vignettes de 300 px de large**, pour des cartes qui en font 180. Le
   double de la taille d'affichage suffit sur un écran à deux pixels par
   point ; 400 px ne se voyait pas et coûtait un tiers d'octets en plus.
4. **Filtres sans JavaScript** : `<details>` natif et liens. Un menu de
   filtre ne coûte donc aucun octet de socle et fonctionne avant que le
   JavaScript soit chargé.
5. **`prefetch={false}`** posé sur tous les liens de liste : fil, recherche,
   cartes produit, boutiques, conversations, menus.

## 6. Ce qu'on ne fait pas, et à quelle condition on y reviendrait

**On ne quitte pas Next.** Un site rendu en HTML pur, sans framework, ferait
tomber le socle de 169 Ko à environ 5 Ko. La tentation est réelle. Mais :

- ce socle est payé **une fois** puis mis en cache, alors que les photos se
  paient à **chaque** écran — c'est donc R1, pas le framework, qui décide de
  la facture mensuelle de tes utilisateurs ;
- les 35 écrans sont écrits en React ; les réécrire coûterait des semaines
  qui ne produiraient aucune fonctionnalité.

**Le déclencheur qui rouvrirait la question :** si, après avoir appliqué R1 à
R4, la première visite dépasse encore 150 Ko, il faudra reposer la question
**avant** de coder les actions — pas après. Changer de socle une fois les
formulaires écrits coûterait deux fois plus cher.

## 7. Vérifier

```
npm run build && npm run poids     # le poids
npm start & npm run parcours       # les parcours, avec ET sans JavaScript
```

À faire avant chaque mise en ligne. Sur le terrain, la vraie mesure reste
l'onglet réseau du navigateur, limité à « Slow 3G », sur la page d'accueil et
sur une fiche produit.
