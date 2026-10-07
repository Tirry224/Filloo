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

- Fait : connexion, session gardée entre deux ouvertures, déconnexion.
- Fait : catalogue sans compte (ville, catégories, à la une, récents ou
  populaires) et fiche produit (photos, prix, boutique, WhatsApp).
- Fait : recherche (mot, ville, catégorie, tri, recherches récentes, nombre
  de résultats ailleurs) et page boutique.
- Provisoire : l'onglet « Compte » montre seulement les comptes de la connexion.
- Fait : inscription d'un client, « Contacter le vendeur », liste des
  conversations et fil en temps réel (citation du produit, fil bloqué ou gelé).
- Attention : un message envoyé depuis l'app ne déclenche ni email ni push
  (voir « App mobile » dans `docs/MEMOIRE.md`).
- Manque : bloquer et signaler, mot de passe oublié,
  espace commerçant, notifications, et les mesures d'usage (`analytics_events`
  s'écrit côté serveur : l'app ne compte encore rien).
