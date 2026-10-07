# Filloo — app mobile

App iPhone et Android de Filloo, en Expo (React Native). Même base
Supabase que le site, aucun code partagé avec lui.

## Lancer l'app sur ton téléphone

1. Copier `.env.example` en `.env` et y mettre les deux valeurs publiques
   du site (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
2. `npm install`, puis `npm start`.
3. Scanner le QR code avec l'app **Expo Go** (App Store ou Play Store).

Attention : la base est celle de la production. Un compte créé ici est
un vrai compte.

## Commandes

- `npm run typecheck` — vérifie les types.
- `npx expo install <paquet>` — ajoute une dépendance (jamais `npm install <paquet>` : Expo choisit la version compatible).

## Où en est l'app

- Fait : connexion, session gardée entre deux ouvertures, déconnexion.
- Fait : catalogue sans compte (ville, catégories, à la une, récents ou
  populaires) et fiche produit (photos, prix, boutique, WhatsApp).
- Fait : recherche (mot, ville, catégorie, tri, recherches récentes, nombre
  de résultats ailleurs) et page boutique.
- Provisoire : l'onglet « Compte » montre seulement les comptes de la connexion.
- Manque : messagerie, signalement, inscription,
  espace commerçant, notifications, et les mesures d'usage (`analytics_events`
  s'écrit côté serveur : l'app ne compte encore rien).
