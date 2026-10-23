# Inventaire des écrans

Un écran par ligne, avec sa route. Relevé sur le code le 2026-10-23 :
quand un écran naît ou disparaît, cette liste change dans le même commit.

**Le numéro (#) est celui de l'inventaire d'origine, cité dans les
commentaires du code** (« écran 18 ») : il ne se réattribue jamais. Les
écrans 2 et 6 (ville sans produit, élargir la zone) ont disparu avec le
filtre de ville, 20 et 21 (boutique en attente, refusée) avec la
validation des boutiques (`0033`).

Les routes `(client)` et `(vendeur)` sont des groupes de `src/app/`
(`docs/ARCHITECTURE.md`).

## Client et visiteur

| # | Écran | Route | Note |
|---|---|---|---|
| 1 | Fil d'accueil | `/` | Toute la Guinée, chips de catégorie, à la une, récents / populaires. La cloche de notifications en haut à droite. |
| 5 | Recherche | `/recherche` | Mot, catégorie, tri (panneaux `<details>`). Au repos : recherches récentes et grille des catégories. Aucun filtre de ville. |
| 7, 8 | Fiche produit | `/produit/[id]` | Photos, prix, négociable, boutique. Un produit vendu reste visible, grisé. |
| 9 | Galerie | `/produit/[id]/photos` | Plein écran, jusqu'à 5 photos. |
| 16 | Contacter | `/produit/[id]/contacter` | Exige un compte ; l'inscription ramène ici (`?next=`). |
| — | WhatsApp | `/produit/[id]/whatsapp` | Route de redirection vers WhatsApp, comptée. |
| 10 | Signaler un produit | `/produit/[id]/signaler` | Motifs + commentaire. |
| 11 | Boutique publique | `/boutique/[id]` | Infos, repère, ville, catalogue. |
| 28, 29 | Messages | `/messages` | Fils par boutique. |
| 30 | Fil de discussion | `/messages/[id]` | Produits cités, temps réel. |
| 31 | Citer un produit | `/messages/[id]/citer` | Ce qui rend viable « un fil par boutique ». |
| 32 | Actions du fil | `/messages/[id]/actions` | Bloquer, débloquer, signaler. |
| 32b | Signaler une conversation | `/messages/[id]/signaler` | Motifs propres aux personnes. |
| 17 | Mon compte | `/compte` | Bascule vers le compte commerçant lié, mot de passe, liens légaux, déconnexion. |
| 18 | Mes informations | `/compte/informations` | Nom et téléphone, mot de passe exigé pour enregistrer. Plus de ville. |
| 18 | Supprimer mon compte | `/compte/informations/supprimer` | Anonymisation, jamais un vrai effacement. |
| — | Personnes bloquées | `/compte/bloques` | Débloquer. |
| 19 | Compte suspendu | `/compte/suspendu` | Lecture seule, recours. |
| 34 | Conditions, confidentialité, contact | `/conditions`, `/confidentialite`, `/contact` | |

## Commerçant

| # | Écran | Route | Note |
|---|---|---|---|
| 22b | Accueil commerçant | `/vendeur` | Chiffres, dernières conversations, raccourcis ; la cloche en haut à droite. |
| 22, 23 | Mes produits | `/vendeur/produits` | Liste, état vide pour le premier produit. |
| 24 | Nouveau produit | `/vendeur/produits/nouveau` | 1 à 5 photos, prix, négociable ; « Publier » propose les notifications. |
| 24 | Modifier un produit | `/vendeur/produits/[id]/modifier` | |
| 25 | Actions produit | `/vendeur/produits/[id]/actions` | Publier, vendu, **remettre en vente**, modifier, masquer / republier, supprimer. |
| 27 | Messages | `/vendeur/messages` et `/vendeur/messages/[id]` (+ `citer`, `actions`, `signaler`) | Le même fil que côté client, monté dans l'espace commerçant. |
| 26 | Ma boutique | `/vendeur/boutique` | Consultation, bascule vers le compte client, mot de passe, déconnexion. |
| 26b | Modifier ma boutique | `/vendeur/boutique/modifier` | Mot de passe exigé : adresse et WhatsApp sont ce qu'un client lit avant de se déplacer. |
| 18, 34 | Mes informations, bloqués, légal | `/vendeur/informations`, `/vendeur/bloques`, `/vendeur/conditions`, `/vendeur/confidentialite`, `/vendeur/contact` | Mêmes composants que côté client, autre retour. |

## Compte et accès

| # | Écran | Route | Note |
|---|---|---|---|
| 12 | Inscription | `/inscription` | Choix du rôle, ou second compte lié si l'on est connecté. |
| 13 | Inscription — boutique | `/inscription/boutique` | Étape 2 des commerçants ; WhatsApp prérempli. |
| 14 | Connexion | `/connexion` | |
| 15 | Mot de passe oublié | `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe` | |
| — | Confirmation d'email | `/auth/confirm` | Route, sans écran propre. |

## Transverse

| # | Écran | Route | Note |
|---|---|---|---|
| 33 | Page introuvable | `not-found.tsx` | Un lien WhatsApp périmé doit pouvoir repartir. |
| — | Erreur | `error.tsx` | Toute erreur non rattrapée ; ne prétend jamais que c'est le réseau (les formulaires disent eux-mêmes une coupure). |
| — | Suivi | `/suivi` | Porteur du projet seul (`OWNER_EMAIL`) ; 404 pour tous les autres. |
| 3, 4 | Hors ligne | — | Un bandeau seulement (`OfflineBanner`) ; aucune page n'est gardée hors ligne. |
