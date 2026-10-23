# Filloo — Spécification de la v1

Marketplace de mise en relation : des commerçants publient leurs produits,
des clients les parcourent et écrivent au commerçant par une messagerie
interne. **Aucun paiement, aucun panier, aucune livraison** : la vente se
fait hors de l'application.

Marché : Guinée · Devise : franc guinéen (GNF) · Langue : français.

Ce document fait foi. Une décision qui change s'y réécrit, avec sa date ;
l'ancienne version se relit par `git log -p -- docs/SPEC.md`.

---

## 1. Décisions

| # | Sujet | Décision |
|---|-------|----------|
| 1 | Authentification | Email + mot de passe (**8 caractères minimum, dont au moins un chiffre**, 2026-10-23 ; la longueur est le réglage Supabase recopié dans `src/lib/password.ts`), **email confirmé obligatoire** (2026-09-17) : sans confirmation, n'importe qui s'inscrit avec l'adresse d'un tiers. Téléphone obligatoire, **non vérifié** (pas de SMS). |
| 2 | Navigation | Catalogue **libre sans compte** ; compte exigé seulement pour écrire. |
| 3 | Catégories | **Neuf**, fixes, sur un niveau, sans fourre-tout « Autre » (`0025`, 2026-09-22) : une catégorie fourre-tout se remplit et vide les autres de leur sens. |
| 4 | Classement | Pas de notation. *À la une* (manuel) → *populaires* (nombre de conversations) → *récents*. |
| 5 | Notifications | Badge de non-lus + notification sur le navigateur (Web Push) et le téléphone (app). **Plus d'email de notification** depuis le 2026-10-07 : l'email ne sert qu'au compte. **Proposées au moment utile** (2026-10-23) : à la publication d'un produit et au premier message, jamais à l'inscription. **Le seul réglage est la cloche de l'en-tête.** |
| 5b | Fils | **Un fil par couple (client, boutique)** ; chaque message cite le produit dont il parle, le premier obligatoirement. |
| 6 | Modération | Publication immédiate, bouton « signaler », masquage par l'administrateur. |
| 7 | Volume cible | 500 commerçants **à un an**. Densité avant volume. |
| 8 | Rôles | **Comptes liés** : un compte client et un compte commerçant derrière une seule connexion, bascule sans se reconnecter, **jamais mélangés sur un même écran**. Chaque profil a sa propre modération, et **se supprime seul** (2026-10-23) : supprimer le compte client laisse la boutique, et inversement ; la connexion n'est fermée qu'avec le dernier compte. Un compte supprimé peut être recréé sur la même connexion (`0041`, 2026-10-23), sauf s'il était suspendu. |
| 9 | Ville | **Seule la boutique a une ville** (2026-10-22). Aucun filtre de ville : accueil et recherche couvrent toute la Guinée, la ville de la boutique s'affiche sur chaque carte. `profiles.city_id` reste en base pour l'app installée. |
| 10 | Disponibilité | Disponible ou vendu, **pas de stock**. Un produit vendu se remet en vente d'un geste (2026-10-22). |
| 11 | Validation commerçant | **Aucune** depuis le 2026-10-02 (`0033`) : la boutique est en ligne dès sa création, ni attente ni refus. Retraits possibles : suspension et suppression du compte. |
| 12 | Brouillons | Un produit peut rester en brouillon avant publication. |
| 13 | Abus | Signalement, suspension, et deux quotas : 20 boutiques contactées et 100 messages par jour et par compte. |
| 14 | Recherche | Titre, description et nom de la boutique, insensible aux accents. |
| 15 | Photos | **1 minimum, 5 maximum** par produit. Compressées sur le téléphone avant l'envoi (1 280 px, 0,5 Mo au plus) ; le stockage refuse plus d'1 Mo et tout format autre que WebP ou JPEG. |
| 16 | Suspension | **Gèle les fils dans les deux sens** (`0022`) ; les fils restent lisibles, jamais supprimés. |
| 17 | Monétisation | Aucune en v1. |
| 18 | Hébergement | Vercel sur **`filloo.net`**, base Supabase à Paris, emails de compte depuis `send.filloo.net`. |
| 19 | App mobile | **App native iPhone et Android** (Expo, 2026-10-07) dans le dépôt `tirry224/filloo-mobile`. Même base, aucun code partagé ; ce qui exige un secret passe par `/api/app/*`. |

## 2. Hors périmètre de la v1

Paiement en ligne · panier · livraison · stock · notation et avis · page
d'administration · plusieurs boutiques par commerçant · plusieurs langues.

## 3. Parcours

- **Visiteur** — parcourt le fil de toute la Guinée, filtre par catégorie,
  recherche, ouvre une fiche. Pour écrire, crée un compte et revient sur
  le produit.
- **Client** — s'inscrit (nom, email, téléphone, mot de passe), écrit au
  commerçant à propos d'un produit, peut signaler ou bloquer.
- **Commerçant** — s'inscrit, confirme son email, renseigne sa boutique
  (nom, ville, repère, WhatsApp repris de son numéro), publie aussitôt,
  reçoit les messages et répond.
- **Client et commerçant à la fois** — une connexion, deux espaces, une
  bascule qui change tout le contexte.
- **Administrateur** — travaille dans le tableau de bord Supabase (masquer
  un produit, suspendre un compte, mettre à la une) et lit `/suivi`.

## 4. Risques

1. **Amorçage** — une marketplace vide n'attire personne : recruter les
   premiers commerçants sur une zone unique.
2. **Réactivité** — un message sans réponse tue la confiance : c'est la
   raison d'être des notifications.
3. **Confiance** — aucune vérification des vendeurs ; les conditions
   d'utilisation et le signalement en tiennent lieu.

## 5. Questions ouvertes

- Captcha à l'inscription.
- Durée de conservation des messages et comptes anonymisés, en attente
  d'un avis sur la loi guinéenne L/2016/037.
