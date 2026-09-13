# Inventaire des écrans — 33

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

## Commerçant — 7

| # | Écran | Note |
|---|-------|------|
| 20 | Boutique en attente | Prépare ses brouillons pendant ce temps |
| 21 | Boutique refusée | Motif + correction possible |
| 22 | Mes produits | Deux chiffres : publiés, messages non lus |
| 23 | Mes produits — vide | Premier produit |
| 24 | Ajouter / modifier un produit | 1 à 3 photos, prix, négociable |
| 25 | Actions produit | Vendu, modifier, masquer, supprimer |
| 26 | Modifier ma boutique | Revalidation si nom ou ville change ; fait aussi office de « compte » côté commerçant (bascule vers le client lié, déconnexion) |

## Messagerie — 6

| # | Écran | Note |
|---|-------|------|
| 27 | Messages — commerçant | Fils par client |
| 28 | Messages — client | Fils par boutique |
| 29 | Messages — vide | |
| 30 | Fil de discussion | Produits cités, produit vendu grisé |
| 31 | Citer un produit | Rend viable « un fil par client » |
| 32 | Actions conversation | Signaler, bloquer |
| 32b | Signaler une conversation | Motifs propres aux personnes, pas ceux des produits. Maquetté dès le début (`design/SignalerConversation.dc.html`), codé ensuite. |

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
