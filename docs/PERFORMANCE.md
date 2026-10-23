# Filloo — tenir sur une mauvaise connexion

Contrainte n°1, au même rang que « ça marche » : rester utilisable sur un
réseau lent, instable et **facturé au mégaoctet**.

Un budget qu'on ne mesure pas est un vœu : `npm run build && npm run
poids` donne les chiffres ci-dessous et **échoue** si un budget est
dépassé. Réécrit le 2026-10-23 sur des mesures du jour ; l'ancienne
version annonçait des règles que le code n'appliquait pas (voir § 4).

---

## 1. Ce que le site pèse (mesuré le 2026-10-23, gzip)

| Poste | Poids | Budget | Payé quand ? |
|---|---|---|---|
| Socle JavaScript + CSS | **169,4 Ko** | ≤ 200 Ko | Première visite, puis en cache |
| Police préchargée (Figtree, une seule) | **19,7 Ko** | ≤ 40 Ko | Première visite |
| HTML d'une page | 2,5 à **12,1 Ko** (`/conditions`) | ≤ 13 Ko | À chaque navigation |
| Photo stockée | **95 Ko** en moyenne (2026-10-22) | ≤ 1 Mo (refusé au-delà) | Une fois à l'envoi, puis à l'affichage en taille adaptée |

Vercel sert en brotli : les chiffres réels sont 15 à 20 % plus bas. Le
socle est le prix d'entrée de Next et React ; on le surveille, on ne le
fait pas descendre sans changer d'outil (§ 5).

## 2. Les règles, par ordre d'impact

Les numéros sont cités dans le code : ils ne se réattribuent pas.

### R1 — Les photos sont le poste n°1

- **Compressées sur le téléphone avant l'envoi** (`compresserPhoto`) :
  1 280 px, 0,5 Mo au plus, WebP, JPEG sur iPhone (Safari n'encode pas le
  WebP). Une photo de téléphone de 3 à 6 Mo part à moins de 100 Ko.
- **Servies en taille adaptée par `next/image`** (`PhotoImage`, `sizes`
  par forme de cadre) : une vignette ne télécharge pas la photo entière.
  Mise en cache un an à l'envoi.
- **Jamais de photo décorative** : les seuls octets d'image sont des
  produits et des boutiques.

### R2 — Ne pas précharger ce qui ne sera pas lu

Next précharge les liens visibles : sur une liste de 24 produits, 24
fiches pour une seule ouverte. **Règle écrite, jamais appliquée** (§ 4) :
`prefetch={false}` sur les liens de liste, à poser ou à abandonner.

### R3 — Le JavaScript se juge au gramme

Un composant client se justifie s'il économise plus qu'il ne pèse
(compression des photos), donne une information que le serveur n'a pas
(bandeau hors ligne) ou évite un aller-retour (recherches récentes,
contraintes natives des formulaires). Le défaut reste le composant
serveur. Ce qui ne sert qu'à quelques écrans se charge à la demande : le
client Supabase du navigateur (~65 Ko) et le compresseur (~20 Ko) ne
font pas partie du socle.

« Tout écran doit marcher sans JavaScript » a été **retiré le
2026-09-22** : un produit sans photo n'est pas publiable, et une
compression ne s'écrit pas sans script.

### R4 — Une seule police

Figtree seule depuis le 2026-09-20 (−40 Ko). Ajouter une police est une
décision, pas un réflexe. `preload: false` remettrait le budget au vert
sans économiser un octet : `npm run poids` ne voit que les polices
préchargées.

### R5 — Demander peu, et une seule fois

- **Le catalogue public est lu une minute en cache** côté serveur : mille
  visiteurs sur l'accueil font une lecture de la base par minute.
- **Une page visitée reste 30 s dans le navigateur**
  (`staleTimes.dynamic`) : revenir sur un onglet ne redemande rien.
- **La recherche ne part qu'à la validation**, jamais à la frappe.
- **Le temps réel passe par un canal privé** par personne (`0038`) : on
  ne reçoit que ses propres messages, pas la table entière.
- **Les fonctions tournent à Paris** (`cdg1`), à côté de la base : à
  Washington, un envoi de message prenait environ 5 s.

### R6 — Le réseau qui tombe est un état normal

- Un bandeau (`OfflineBanner`) dit que la connexion manque.
- Un formulaire qui échoue garde sa saisie et le dit (`useFormulaire`).
- Le service worker (`public/sw.js`) **ne sert qu'aux notifications** et
  ne met rien en cache. Garder les fiches déjà vues hors ligne reste à
  faire ; prévoir dès le premier jour comment le désinstaller.

### R7 — Un squelette de chargement se justifie par une attente mesurée

Et il doit ressembler à la page, sinon l'écran saute au remplacement.

### R8 — Le formulaire vérifie d'abord dans le navigateur

`required`, `pattern`, `type="email"` : une faute de frappe ne coûte
aucun aller-retour. Le serveur revalide tout, sans exception.

## 3. Ce que ces règles interdisent

Vidéo · bannières et illustrations · polices supplémentaires ·
bibliothèque de composants · animations au défilement · carrousels ·
recherche à la frappe · publicité · outils d'analyse tiers · cartes
interactives.

## 4. Écarts entre l'ancien document et le code (constatés le 2026-10-23)

L'ancienne version les présentait comme faits ; ils ne le sont pas.

- **`prefetch={false}` sur les liens de liste** : aucun dans le code. Next
  précharge donc les liens visibles. À trancher : poser la règle
  (`src/components/product/ProductCard.tsx` et les listes) ou l'oublier.
- **12 produits par écran et un bouton « Voir plus »** : l'accueil et la
  recherche en chargent jusqu'à 50, sans bouton.
- **Deux tailles de photo stockées à l'envoi** : une seule est stockée ;
  c'est `next/image` qui produit les tailles d'affichage.
- **« Pas de temps réel permanent »** : le temps réel est actif tant que
  l'application est ouverte, par canal privé (R5).

## 5. On ne quitte pas Next

Un site en HTML pur ferait tomber le socle de 169 Ko à environ 5 Ko, mais
ce socle est payé **une fois**, alors que les photos se paient à
**chaque** écran : c'est R1, pas le framework, qui fait la facture.
Réécrire les écrans coûterait des semaines sans une fonctionnalité de
plus.

## 6. Vérifier

```bash
npm run build && npm run poids     # les budgets
npm run e2e                        # les parcours (e2e/README.md)
```

Sur le terrain, la vraie mesure reste l'onglet réseau du navigateur en
« Slow 3G », sur l'accueil et une fiche produit.
