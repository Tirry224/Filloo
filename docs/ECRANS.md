# Inventaire des écrans — 35

Liste exhaustive. Elle sert de plan de construction : chaque ligne est un
écran à coder, et chaque case cochée est du travail réellement terminé.

## Client — 11

| # | Écran | Note |
|---|-------|------|
| 1 | Fil d'accueil | À la une, populaires, récents |
| 2 | Fil — ville sans produit | État vide, propose de changer de ville |
| 3 | Fil — chargement | Squelette, jamais d'écran blanc |
| 4 | Fil — hors ligne | Bandeau + produits déjà consultés |
| 5 | Recherche & filtres | Ville, catégorie, tri |
| 6 | Recherche — aucun résultat | Propose d'élargir la zone |
| 7 | Fiche produit | Photos, prix, négociable, boutique |
| 8 | Fiche produit — vendu | Grisée, prix barré, produits similaires |
| 9 | Galerie photo | Plein écran, 3 photos maximum |
| 10 | Signaler un produit | Motifs + commentaire |
| 11 | Boutique publique | Infos + catalogue du commerçant |

## Compte & accès — 8

| # | Écran | Note |
|---|-------|------|
| 12 | Inscription — choix du rôle | Choix non définitif : bascule possible plus tard vers l'autre compte lié |
| 13 | Inscription — ma boutique | Étape 2, commerçants uniquement |
| 14 | Connexion | |
| 15 | Mot de passe oublié | |
| 16 | Compte requis | Déclenché par « Contacter le vendeur » |
| 17 | Mon compte | Carte de bascule vers le compte commerçant lié, jamais un item de menu comme les autres |
| 18 | Mes informations | Modification, suppression du compte |
| 19 | Compte suspendu | Motif + recours |

## Commerçant — 9

Quatre onglets depuis le 2026-09-16 (`Accueil · Produits · Messages ·
Boutique`), comme le prototype le prévoyait. `/vendeur` portait jusque-là
les chiffres ET la liste des produits : les cartes repoussaient le
catalogue vers le bas, et un catalogue un peu long noyait les chiffres.

| # | Écran | Route | Note |
|---|-------|-------|------|
| 20 | Boutique en attente | `/vendeur/attente` | Prépare ses brouillons pendant ce temps |
| 21 | Boutique refusée | `/vendeur/refusee` | Motif + correction possible |
| 22 | Mes produits | `/vendeur/produits` | La liste seule ; « Ajouter » en tête de barre, pas en pied de page où il recouvrait le dernier produit |
| 22b | Accueil commerçant | `/vendeur` | Salutation, trois chiffres, trois dernières demandes. Le troisième chiffre n'est PAS les « vues boutique » du prototype : aucune table ne les compte, on affiche la somme de `products.contact_count` (clients distincts ayant posé une question) |
| 23 | Mes produits — vide | `/vendeur/produits` | Premier produit. L'appel à l'action reste aussi sur l'accueil : trois zéros ne disent pas quoi faire |
| 24 | Ajouter / modifier un produit | `/vendeur/produits/nouveau`, `…/[id]/modifier` | 1 à 3 photos, prix, négociable. « Publier » n'apparaît qu'à une boutique validée (`canPublish`) |
| 25 | Actions produit | `/vendeur/produits/[id]/actions` | Publier un brouillon, vendu, modifier, masquer, supprimer. Les lignes suivent le statut réel du produit |
| 26 | Ma boutique | `/vendeur/boutique` | **Consultation.** Les informations se lisent, elles ne s'y saisissent plus. Fait office de « compte » côté commerçant (bascule vers le client lié, suppression, déconnexion) |
| 26b | Modifier ma boutique | `/vendeur/boutique/modifier` | Plein écran. Le mot de passe s'y change aussi. **Enregistrer exige le mot de passe actuel** — sans lui, rien ne bouge. La flèche retour EST le bouton annuler ; les deux sorties mènent à l'écran 26. Aucune revalidation de la boutique : changer le nom ou la ville ne déclenche RIEN (voir `updateMerchantAction`, et la contradiction encore ouverte dans REPRISE) |

## Messagerie — 6

Deux arbres de routes depuis le 2026-09-16, un par espace. Le paramètre
`?vue=commercant` n'existe plus : un même chemin ne peut plus rendre deux
écrans différents. Le fil et ses feuilles sont un composant partagé,
monté par deux routes qui lui imposent chacune leur espace.

| # | Écran | Route client | Route commerçant | Note |
|---|-------|--------------|------------------|------|
| 27 | Messages — commerçant | — | `/vendeur/messages` | Fils par client |
| 28 | Messages — client | `/messages` | — | Fils par boutique |
| 29 | Messages — vide | les deux | les deux | Pas une route : l'état vide des écrans 27 et 28, avec un texte propre à chaque espace |
| 30 | Fil de discussion | `/messages/[id]` | `/vendeur/messages/[id]` | Produits cités, produit vendu grisé. Un fil ouvert depuis le mauvais espace renvoie vers le bon |
| 31 | Citer un produit | `…/[id]/citer` | `…/[id]/citer` | Rend viable « un fil par client » |
| 32 | Actions conversation | `…/[id]/actions` | `…/[id]/actions` | Signaler, bloquer |
| 32b | Signaler une conversation | `…/[id]/signaler` | `…/[id]/signaler` | Motifs propres aux personnes, pas ceux des produits. Maquetté dès le début (`design/SignalerConversation.dc.html`), codé ensuite. |

## Transverse — 1

| # | Écran | Note |
|---|-------|------|
| 33 | Page introuvable (404) | Ajouté après coup : l'inventaire des 32 écrans supposait que l'utilisateur ne se trompe jamais d'adresse. Un lien partagé sur WhatsApp qui traîne, un produit retiré, une faute de frappe — ça arrive, et Next affiche sinon sa propre page en anglais sans aucun moyen de repartir. |

## Ce que cet inventaire a révélé

Trois besoins qui n'existaient nulle part dans la spécification. Les trois
sont maintenant résolus (voir `docs/REPRISE.md`, section 4) :

1. ~~**Blocage entre personnes**~~ — écran 32. Résolu :
   `conversations.blocked_by`.
2. ~~**Motif de refus d'une boutique**~~ — écran 21. Résolu :
   `merchants.rejection_reason`.
3. ~~**Suppression de compte**~~ — écran 18. Résolu : anonymisation
   (`profiles.is_deleted`/`deleted_at`), jamais un effacement réel — les
   conversations de l'autre partie restent lisibles.
