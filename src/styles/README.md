# Styles

Trois fichiers, trois rôles distincts. Le découpage n'est pas décoratif :
il répond à la question « où est-ce que je dois aller pour changer ça ? ».

| Fichier | Contient | Tu y vas pour… |
|---|---|---|
| `tokens.css` | Les **valeurs** : couleurs, tailles de texte, rayons, espacements | Changer l'apparence de toute l'application |
| `base.css` | Ce qui s'applique **partout** : fond, police, titres, focus | Modifier un comportement global |
| `index.css` | L'**ordre** des imports | Presque jamais |

---

## Le vocabulaire d'espacement

C'est la partie du système qui a été reprise en dernier, et celle qui rendait
le projet pénible à modifier. L'application utilisait **27 valeurs
d'espacement différentes**, demi-pas compris : `gap-2.5` (10px), `gap-3.5`
(14px), `px-4.5` (18px), `p-7` (28px). Aucun critère ne permettait de choisir
entre `gap-2.5` et `gap-3` — donc personne ne pouvait savoir, en lisant, ce
qui était une intention et ce qui était un accident.

**Six noms les remplacent.** Ils ne disent pas une mesure, ils disent ce
qu'ils séparent :

| Nom | Mesure | Sépare |
|---|---|---|
| `hair` | 4px | Une icône et son intitulé, deux lignes d'une même étiquette |
| `tight` | 8px | Deux éléments liés dans un même bloc |
| `snug` | 12px | L'intérieur d'une carte, une ligne de liste |
| `gutter` | 16px | La gouttière : marge latérale de tout écran |
| `section` | 24px | Deux sections d'un écran |
| `air` | 32px | La respiration d'un écran vide |

Ils s'écrivent avec tous les préfixes habituels :

```
gap-hair    px-gutter    py-section    p-snug    -mx-gutter    mt-tight
```

L'intérêt n'est pas d'avoir moins de valeurs : c'est que **la question posée
au moment d'écrire ait une réponse**. « Ces deux éléments appartiennent-ils au
même bloc ? » se tranche ; « est-ce 10 ou 12 pixels ? » ne se tranche pas.

### Les objets carrés

Même histoire : sept tailles de pastilles et de vignettes coexistaient, de 18
à 64px. Cinq noms suffisent — `mark` (24px), `thumb-xs` (20), `thumb-sm` (36),
`thumb` (56), `thumb-lg` (64) — auxquels s'ajoutent les hauteurs de commande
`tap` (44), `control` (52) et `nav` (64), et les deux hauteurs de photo
`photo-card` (128) et `photo-hero` (288).

### Et si une valeur manque ?

L'échelle chiffrée de Tailwind (`p-2`, `gap-5`, `mt-7`…) **reste active**.
Elle est réservée aux **exceptions** : la géométrie d'un objet dessiné — la
poignée d'une feuille modale, la course d'un interrupteur, la silhouette d'un
squelette de chargement.

Deux règles la rendent inoffensive :

1. Une valeur chiffrée dans du code de mise en page **porte un commentaire**
   qui commence par `EXCEPTION` et dit pourquoi. Il y en a cinq dans tout le
   projet ; elles se trouvent en cherchant ce mot.
2. On ne l'utilise **jamais** pour une marge, une gouttière ou un écart entre
   blocs. Ces trois-là ont toujours un nom.

C'est ce qui rend l'exception visible dans un diff au lieu de la laisser
passer pour la norme.

---

## Comment changer quelque chose

**Changer la couleur de l'application** — une seule ligne dans `tokens.css` :

```css
--color-accent: oklch(0.55 0.15 42);   /* terre cuite */
--color-accent: oklch(0.55 0.15 150);  /* vert */
--color-accent: oklch(0.55 0.15 250);  /* bleu */
```

Le troisième nombre est la teinte, sur un cercle de 0 à 360. Garde les deux
premiers (clarté et saturation) : c'est ce qui fait que la couleur reste
lisible en texte blanc dessus, et cohérente avec les couleurs d'état.

**Rendre toute l'interface plus aérée** — change les six valeurs
d'espacement dans `tokens.css`, pas les composants. Passer `--spacing-snug` de
`0.75rem` à `0.875rem` écarte d'un coup l'intérieur de toutes les cartes, de
toutes les lignes de liste et de toutes les barres de l'application. C'est
exactement ce que le vocabulaire nommé achète : **un réglage central au lieu
d'une chasse dans quarante fichiers**.

**Grossir tout le texte** — les tailles de `--text-*` sont en `rem`, donc
relatives à la taille de base du navigateur. Pour tout grossir de 10 %,
ajoute `font-size: 110%` sur `html` dans `base.css`. Ne touche pas aux huit
valeurs une par une.

**Changer l'apparence d'un composant** — pas ici : en haut du fichier du
composant, dans sa table de styles. Voir `src/components/README.md`.

**Ajouter une couleur** — pose-toi d'abord la question : est-ce un nouveau
*rôle* (une information nouvelle à transmettre) ou juste une envie ? Si c'est
un rôle, ajoute-le dans `tokens.css` avec un nom qui dit son rôle
(`--color-info`, pas `--color-violet`). Sinon, réutilise l'existant.

---

## La règle qui protège tout le système

**Aucune valeur de couleur, de taille de texte ou de rayon ne doit apparaître
ailleurs que dans `tokens.css`.**

```bash
grep -rnE '#[0-9a-fA-F]{3,6}|oklch\(|rgb\(' src/components src/app
```

Cette commande ne doit rien renvoyer. Elle renvoyait `bg-[#12100e]` — le fond
de la galerie photo, seule couleur qui échappait encore au système ; c'est
devenu `--color-viewer`.

Une seule exception subsiste, et elle est inévitable : `themeColor` dans
`src/app/layout.tsx`. Le navigateur lit cette valeur **avant** tout CSS, pour
teinter sa propre barre. Elle doit rester la copie de `--color-paper`.

---

## Le piège des classes qui n'existent pas

**Une classe Tailwind inexistante ne produit aucune erreur.** Ni `tsc`, ni
`next build`, ni le navigateur ne disent quoi que ce soit : le style
disparaît, en silence.

Ce n'est pas théorique. L'écran d'inscription portait `border-6` sur la
pastille du rôle choisi. Tailwind ne connaît que `border-2`, `border-4` et
`border-8` : **la pastille sélectionnée n'a jamais rien affiché**, et le
build passait au vert tout du long.

Depuis que les tokens définissent un vocabulaire fermé, le risque augmente :
`gap-hairr` ou `px-guttre` sont exactement aussi silencieux. D'où :

```bash
npm run verifier-classes    # chaque classe écrite produit-elle du CSS ?
npm run verifier            # les types ET les classes
```

Le script compile le CSS réel, relève toutes les classes écrites dans `src/`
et signale celles qui ne produisent rien. Il est le seul garde-fou possible
contre une faute de frappe dans un nom de token.

---

## Pourquoi la palette par défaut de Tailwind est effacée

`tokens.css` contient `--color-*: initial;`, qui supprime les couleurs livrées
avec Tailwind. Écrire `bg-blue-500` ne produit donc plus rien du tout. C'est
voulu : on ne peut pas introduire une couleur hors charte par distraction, et
le jour où on veut voir toutes les couleurs de l'application, elles sont dans
un seul fichier.

La même chose n'a **pas** été faite pour les espacements (`--spacing-*:
initial` supprimerait `p-2`, `gap-5`…) : c'est un choix délibéré, pour garder
une échappatoire aux objets dessinés. Le vocabulaire nommé tient par
l'habitude et par le vérificateur, pas par l'interdit.
