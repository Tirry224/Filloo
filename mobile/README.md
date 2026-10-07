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

## Installer l'app sur des téléphones de test (sans Expo Go)

EAS, le service de compilation d'Expo, fabrique l'app dans le nuage : pas
besoin de Mac ni d'Android Studio.

1. Créer un compte gratuit sur expo.dev, puis `npx eas-cli@latest login`.
2. `npx eas-cli@latest init` — relie ce dossier à un projet Expo (écrit un
   `projectId` dans `app.json`, à committer).
3. Déclarer les trois valeurs publiques pour les compilations (le fichier
   `.env` n'est pas envoyé) :
   `npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value … --visibility plaintext`,
   puis pareil pour `EXPO_PUBLIC_SUPABASE_ANON_KEY` et `EXPO_PUBLIC_SITE_URL`,
   et encore pour l'environnement `production` le moment venu.
4. Android : `npx eas-cli@latest build --profile preview --platform android`
   donne un lien vers un fichier `.apk` à installer directement sur les
   téléphones des testeurs.
5. iPhone : il faut d'abord un compte Apple Developer (99 $ par an) ; la
   diffusion de test passe ensuite par TestFlight
   (`--profile production --platform ios`, puis `eas submit`).

Identifiant de l'app sur les deux stores : `com.filloo.app` (dans
`app.json`). Il ne se change plus une fois l'app publiée.

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
- Fait (les deux) : bloquer, débloquer, signaler ; mot de passe oublié,
  mes informations, changer de mot de passe ; suppression du compte par
  le site.
- Le destinataire d'un message est prévenu (push web, email) par le site :
  `EXPO_PUBLIC_SITE_URL` doit désigner un déploiement qui porte
  `/api/app/message-envoye`.
- Manque : notifications natives du téléphone, mesures d'usage, liste
  « Personnes bloquées », publication sur les stores (voir « App mobile »
  dans `docs/MEMOIRE.md`).
