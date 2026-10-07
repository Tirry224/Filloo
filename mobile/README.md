# Filloo — app mobile

App iPhone et Android de Filloo, en Expo (React Native). Même base
Supabase que le site, aucun code partagé avec lui.

## Lancer l'app sur ton téléphone

1. Copier `.env.example` en `.env` et le remplir avec les valeurs publiques
   du site (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SITE_URL`).
2. `npm install`, puis `npm start`.
3. Scanner le QR code avec l'app **Expo Go** (App Store ou Play Store).

Attention : la base est celle de la production. Un compte créé ici est
un vrai compte.

## Commandes

- `npm run typecheck` — vérifie les types.
- `npx expo install <paquet>` — ajoute une dépendance (jamais `npm install <paquet>` : Expo choisit la version compatible).

## Où en est l'app

- Fait (client) : catalogue, recherche, fiche produit, page boutique,
  inscription, connexion, « Contacter le vendeur », messagerie en temps réel.
- Fait (commerçant) : inscription en deux temps (compte puis boutique),
  ouverture d'une boutique depuis un compte client, accueil, mes produits
  (publier, vendu, masquer, supprimer), création et modification d'un
  produit avec photos, messagerie, modification de la boutique (mot de
  passe redemandé), bascule entre les deux espaces.
- Attention : un message envoyé depuis l'app ne déclenche ni email ni push,
  et l'app ne compte aucune mesure (voir « App mobile » dans `docs/MEMOIRE.md`).
- Manque : bloquer et signaler, mot de passe oublié, modifier ses
  informations ou supprimer son compte, notifications push natives,
  icônes et publication sur les stores.
