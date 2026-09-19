# Inventaire des écrans — 36

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

| # | Écran | Note |
|---|-------|------|
| 20 | Boutique en attente | Prépare ses brouillons pendant ce temps |
| 21 | Boutique refusée | Motif + correction possible |
| 22 | Mes produits | La liste seule, sur `/vendeur/produits` : séparée de l'accueil le 2026-09-16, parce que mêler un tableau de bord et une liste obligeait à faire défiler le premier pour atteindre la seconde. |
| 22b | Accueil commerçant | Le tableau de bord de l'espace, sur `/vendeur` : les deux chiffres (publiés, messages non lus) et les raccourcis. |
| 23 | Mes produits — vide | Premier produit |
| 24 | Ajouter / modifier un produit | 1 à 3 photos, prix, négociable |
| 25 | Actions produit | Vendu, modifier, masquer, supprimer |
| 26 | Ma boutique | Écran de CONSULTATION : on y lit ses informations et on y trouve le compte (bascule vers le client lié, déconnexion). |
| 26b | Modifier ma boutique | Écran plein écran, atteint par un geste explicite. Revalidation si le nom ou la ville change, et le mot de passe actuel est redemandé — l'adresse et le numéro WhatsApp sont ce qu'un client lit AVANT de se déplacer. |

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

## Transverse — 2

| # | Écran | Note |
|---|-------|------|
| 34 | Conditions d'utilisation | Ajouté le 2026-09-17, quand le texte a enfin existé. Un composant, DEUX routes — `/conditions` (publique, comme le catalogue) et `/vendeur/conditions` (dans l'espace commerçant) — parce que le texte est le même des deux côtés mais que le lien de retour ne l'est pas. |
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
