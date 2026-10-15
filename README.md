# Filloo

Marketplace de mise en relation entre commerçants et clients, en Guinée.
Le commerçant publie ses produits, le client les parcourt librement et le
contacte par messagerie interne. **Aucun paiement en ligne** : la vente se
conclut hors de l'application.

- **Reprendre le travail : [`docs/MEMOIRE.md`](docs/MEMOIRE.md)**
- Spécification complète : [`docs/SPEC.md`](docs/SPEC.md)
- Base de données : [`supabase/migrations/`](supabase/migrations/)

## État d'avancement

- [x] Spécification validée
- [x] Schéma de base de données, règles métier et sécurité (RLS)
- [x] Tests de sécurité — **158 vérifications, exécutées et au vert le
      2026-09-22** sur un PostgreSQL 16 local portant les 24 migrations.
      Le chiffre sort du script, il ne se recopie plus d'un document à
      l'autre (l'ancien, 153, circulait sans que personne ne l'ait vu)
- [x] Tests de la couche applicative — `npm run tests`, 25 cas, sans
      aucune dépendance (`node --test`)
- [x] Budgets de performance mesurés (`npm run poids`, voir `docs/PERFORMANCE.md`)
- [x] Projet Supabase créé et migrations exécutées
- [x] Design system et bibliothèque de composants (`src/styles/`, `src/components/`)
- [x] Les 36 écrans
- [x] Branchement sur la vraie base, en lecture ET en écriture : catalogue
      public, espace vendeur, messagerie, compte et suppression de compte
- [x] Authentification (inscription, connexion, comptes liés)
- [x] Déploiement Vercel — `main` est la branche de production, en ligne
      sur `https://filloo.net` depuis le 2026-10-08 ; `dev` a sa préversion
- [x] API de l'app mobile en production (`/api/app/message-envoye`,
      `/api/app/supprimer-compte`) depuis la fusion de `dev` du 2026-10-09
- [ ] Parcours complet des écrans dans un navigateur (commencé le 12/09)
- [x] Plus d'email de notification (décision du 2026-10-07) : messages et
      suspensions partent par notification, navigateur (Web Push) et
      téléphone (app mobile) — aucune encore vue arriver (2026-10-09)
- [x] Une boutique est en ligne dès sa création, sans validation manuelle
      (`0033`) ; le lien de confirmation de l'email est la seule
      vérification. La suspension d'un compte s'annonce par notification
      (`0021` + Vercel Cron)
- [x] Emails de compte envoyés par Resend depuis `noreply@send.filloo.net`
      (posé le 2026-10-08, SPF, DKIM et DMARC chez Cloudflare) ; ils
      remplacent le SMTP Gmail. Aucun envoi encore vu dans les journaux
- [ ] **Le cron du matin n'a jamais vidé la file `notifications`**
      (constaté le 2026-09-21). Elle ne porte plus que les suspensions
      depuis `0033`. Suspect : `CRON_SECRET` absente de Vercel
- [x] Confirmation d'email active (constaté le 2026-10-09 : un compte
      attend sa confirmation) ; reste à vérifier que les Redirect URLs
      portent `https://filloo.net/**`
- [x] Partage et référencement : Open Graph sur les fiches produit et
      boutique, `sitemap.xml`, `robots.txt`
- [x] Politique de confidentialité (`/confidentialite`) et écran de
      contact (`/contact`) — les deux promesses des articles 19 et 24 des
      conditions. **Reste à remplir `EDITEUR_NOM`** dans
      `src/content/confidentialite.ts`
- [x] Compteurs d'usage : onze événements mesurés côté serveur, sans
      JavaScript envoyé au téléphone et sans donnée identifiante
      (migration `0024`)
- [x] Conditions d'utilisation — texte fourni le 2026-09-17, écran 34
      (`/conditions` et `/vendeur/conditions`), les deux lignes de menu
      mènent enfin quelque part

## Tests

Les règles de sécurité sont couvertes par des tests exécutables sur un
PostgreSQL local : voir [`supabase/tests/README.md`](supabase/tests/README.md).
À lancer après toute modification d'une policy. Dernière exécution réelle :
**158 vérifications au vert, le 2026-09-22.**

La couche applicative a ses propres tests, sans aucune dépendance à
installer — Node 22 exécute `node --test` et lit le TypeScript tel quel :

```bash
npm run tests
```

Ils couvrent d'abord ce qui fait mal quand il casse : `safeNextPath`, seul
endroit qui décide si une adresse de reprise est sûre, les règles de
saisie vérifiées côté serveur, et l'adresse du site dont dépendent tous
les liens partant en email.

Les migrations du dépôt et celles de la production se comparent dans les
deux sens — une migration commitée mais jamais appliquée, ou appliquée au
tableau de bord mais jamais commitée :

```bash
npm run migrations                       # lit la production par l'API de gestion
npm run migrations -- --json liste.json  # ou compare à une liste déjà obtenue
```

La première forme demande `SUPABASE_ACCESS_TOKEN` (supabase.com → Account
→ Access Tokens) dans `.env.local`, **jamais dans `.env`** : ce jeton ouvre
tous les projets du compte.

## Démarrer l'application

```bash
npm install
npm run dev
```

**`/ecrans`** liste les 36 écrans avec un lien vers chacun, et dit ce
qu'il faut créer en base quand un lien a besoin d'un enregistrement qui
n'existe pas encore. C'est le point d'entrée pour tout relire.

Page de travail : **accessible en développement seulement**, introuvable
en production. À supprimer pour de bon quand le parcours complet des
écrans sera terminé.

Toute autre adresse affiche la page « Cette page n'existe pas ».
- **`/styleguide`** : tous les composants et tous les tokens sur une page.

`.env.local` est nécessaire pour démarrer (voir plus bas) : sans lui,
l'application s'arrête tout de suite avec un message explicite plutôt que
de laisser une erreur réseau incompréhensible apparaître plus tard.

**Toute l'application lit et écrit la vraie base** : catalogue public,
espace vendeur, messagerie, compte et suppression de compte. `mock.ts` ne
sert plus que la galerie `/styleguide` et la liste des motifs de
signalement.

**La base est vide** : le jeu de démonstration a été supprimé le
2026-09-12 pour tester avec de vraies données. Pour le remettre,
rejouer `supabase/seed_demo.sql` (deux boutiques, six produits) ; la
commande pour l'enlever à nouveau est à la fin du fichier.

Une boutique créée depuis l'application arrive en `pending` : la
validation est **manuelle**, depuis Supabase, et il n'y a pas de page
d'administration en v1. Changer la seule cellule `merchants.status`
suffit — voir `supabase/migrations/0012_...sql`.

Pour changer l'apparence de l'application, voir
[`src/styles/README.md`](src/styles/README.md).

## Mise en place de la base

1. Créer un projet sur [supabase.com](https://supabase.com) (offre gratuite),
   région Europe de l'Ouest — la plus proche de la Guinée.
2. Dans **SQL Editor**, exécuter les fichiers de `supabase/migrations/`
   **dans l'ordre numérique**, un par un. Lire les commentaires en même
   temps : ils expliquent chaque décision.
3. Dans **Authentication → Providers**, garder `Email` activé. La
   confirmation par email est **décidée et à activer** (SPEC décision 1) —
   mais seulement une fois le SMTP de production posé : activée avant,
   plus personne ne peut s'inscrire, puisque personne ne recevra le lien.
4. Vérifier dans **Database → Tables** que chaque table affiche bien
   « RLS enabled ». Si une seule ne l'est pas, ses données sont publiques.

## Variables d'environnement

À placer dans `.env.local`, **jamais** dans un fichier versionné :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

La clé `anon` est conçue pour être exposée au navigateur : c'est le RLS qui
protège les données, pas le secret de cette clé. En revanche la clé
`service_role` ignore complètement le RLS et donne un accès total à la base.
Elle ne doit jamais apparaître dans le code du navigateur, ni dans Git.

### Plus d'email de notification (depuis le 2026-10-07)

Décision du porteur du projet : l'email ne sert plus qu'au compte
(confirmation d'adresse, mot de passe oublié), envoyés par Supabase lui-même
(voir « Emails d'authentification » plus bas). Nouveaux messages, nouvelles
demandes et suspensions partent par **notification** seulement : sur le
téléphone qui porte l'app mobile (Expo, migration `0035`) et dans le
navigateur abonné (Web Push, `0023`). `RESEND_API_KEY` et `EMAIL_FROM` ne
servent plus et peuvent être retirées de Vercel.

```
NEXT_PUBLIC_SITE_URL=https://filloo.net
EXPO_ACCESS_TOKEN=   # facultatif
```

- `NEXT_PUBLIC_SITE_URL` — l'adresse publique du site, **sans barre
  oblique finale** : elle sert aux liens des emails de compte.
- `EXPO_ACCESS_TOKEN` — facultatif. À poser seulement si la sécurité
  renforcée des notifications est activée sur le projet Expo : elle exige
  alors que chaque envoi porte ce jeton.

### Écran de suivi (`/suivi`)

Les chiffres d'usage (visites, contacts, inscriptions, recherches, ce qui
attend une action) se lisent sur `/suivi`, réservé au porteur du projet.

```
OWNER_EMAIL=<l'adresse du compte Filloo du porteur du projet>
```

- `OWNER_EMAIL` — seule une connexion avec cette adresse, CONFIRMÉE, voit
  la page ; tout autre visiteur reçoit « page introuvable ». **Sans elle,
  personne n'entre**, propriétaire compris.
- Les chiffres viennent de `suivi_chiffres` (`0034`), appelable par
  `service_role` seulement.

### Décisions d'administration (Vercel Cron)

Trois décisions se prennent dans le tableau de bord Supabase et ne
déclenchent AUCUN code de l'application : valider une boutique, la
refuser, suspendre un compte. La migration `0021` les fait noter en base
par des triggers, dans la table `notifications`, et un balayage
périodique vide cette file en envoyant les emails.

```
CRON_SECRET=<une chaîne longue et aléatoire>
```

- `CRON_SECRET` — Vercel la joint automatiquement aux appels du cron, en
  en-tête `Authorization: Bearer …`. **Sans elle, `/api/notifications`
  refuse tout le monde** : une adresse qui lit `auth.users` et envoie des
  emails ne s'ouvre pas au public par accident.
- La planification vit dans `vercel.json` (`0 7 * * *`, soit une fois par
  jour à 7 h UTC). **Cette expression est dictée par l'offre, pas par le
  besoin** : sur le plan Hobby, Vercel REFUSE le déploiement d'un projet
  dont un cron tourne plus d'une fois par jour — la planification
  `*/10 * * * *` qui vivait ici bloquait donc TOUS les déploiements, y
  compris ceux qui ne touchaient pas au cron.
- **Conséquence à connaître : un commerçant validé attend jusqu'à 24 h son
  email.** Ce n'est pas le NOMBRE d'emails qui est limité — chaque passage
  vide toute la file, dix validations dans la journée font dix emails —
  mais le DÉLAI entre la décision prise dans Supabase et sa notification.
- Trois sorties si ce délai ne convient pas : repasser au plan payant et
  remettre `*/10 * * * *` ; appeler `/api/notifications` depuis un
  planificateur externe gratuit (une action GitHub programmée, avec
  `CRON_SECRET` et l'URL de production en secrets du dépôt) ; ou planifier
  l'appel depuis Supabase avec `pg_cron` + `pg_net` (disponibles, non
  installés). La route ne change dans aucun des trois cas.

## Notifications push (en cours de construction)

Faites de bout en bout le 2026-09-19. Un commerçant active les
notifications depuis « Ma boutique » → « Notifications », et reçoit une
alerte sur son écran verrouillé dès qu'un message arrive. L'email
continue de partir dans tous les cas : il rattrape un iPhone non
installé, une permission refusée, un téléphone changé.

**Ce qui reste à CONSTATER sur de vrais téléphones** : l'installation
depuis Android, l'installation depuis un iPhone, et une notification
réellement reçue écran éteint.

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<déjà dans .env, publique par nature>
VAPID_PRIVATE_KEY=<Vercel uniquement, jamais ici>
```

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — le navigateur la reçoit de toute
  façon : c'est elle qu'il envoie au service de push pour créer un
  abonnement. Elle vit donc dans `.env`, versionné.
- `VAPID_PRIVATE_KEY` — **posée dans Vercel, à ne jamais recopier ici.**
  Quiconque l'obtient peut notifier tous les abonnés au nom de Filloo.
- **La migration `0023` est exécutée** (2026-09-19) : la table
  `push_subscriptions` existe, avec son RLS et ses quatre policies.
- **Sur iPhone, le push n'existe que si l'application a été « ajoutée à
  l'écran d'accueil »** — Safari ne l'autorise pas autrement. Sur Android,
  le navigateur suffit.
- **Le service worker ne met RIEN en cache** (`public/sw.js`) : il ne sert
  qu'à recevoir les notifications. Pour le désinstaller partout, vider ce
  fichier et déployer ; pour un seul téléphone, ouvrir l'app avec
  `?sw=off`.
- **Le bouton « M'envoyer une notification test »** reste dans
  l'application après la mise au point : le jour où un commerçant dira
  « je ne reçois rien », il répond en trois secondes.
- **Le push ne recopie JAMAIS le message**, contrairement à l'email : il
  s'affiche sur un écran verrouillé que n'importe qui à côté peut lire.

Ce qui coince se voit en une requête, et c'est tout l'intérêt d'être
passé par une file plutôt que par un webhook :

```sql
select kind, profile_id, attempts, last_error, created_at
  from notifications
 where sent_at is null
 order by created_at;
```

### Emails d'authentification (Supabase → SMTP)

**Ils ne passent PAS par `RESEND_API_KEY`.** Mot de passe oublié et
confirmation d'inscription sont envoyés par le serveur Auth de Supabase,
avec le SMTP configuré dans **Authentication → Emails → SMTP Settings**.
C'est de la configuration, pas du code : rien dans ce dépôt ne les
envoie.

**Le SMTP est celui de Resend, sur le domaine du projet** (depuis le
2026-10-08) : expéditeur `noreply@send.filloo.net`, domaine `filloo.net`
vérifié chez Resend, SPF, DKIM et DMARC déclarés chez Cloudflare. Les
enregistrements DNS de `send` et `_dmarc` ne se touchent pas : sans eux,
les emails repartent en courrier indésirable.

Avant, du 2026-10-07 au 2026-10-08 : le SMTP Gmail de
`filloo.gn@gmail.com` (environ 500 envois par jour), faute de domaine —
Resend n'envoie sans domaine vérifié qu'au propriétaire du compte.

### Confirmation de l'email à l'inscription

Trois réglages du tableau de bord, tous nécessaires :

- **Authentication → Sign In / Providers → Email → Confirm email : activé.**
- **Authentication → Emails → Confirm signup**, le lien du modèle :
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`.
  `RedirectTo` porte toujours `?origine=inscription` (`lienDeConfirmation`,
  `src/lib/actions/auth.ts`), d'où le `&`.
- **Authentication → URL Configuration → Redirect URLs** contient
  `https://filloo.net/**` (et le Site URL vaut `https://filloo.net`)
  depuis le changement de domaine du 2026-10-08. Sinon Supabase remplace `RedirectTo` par
  le Site URL, sans `?`, et le lien est cassé.

### Le code dans les emails, pour l'app mobile

L'app mobile (`tirry224/filloo-mobile`) n'ouvre pas les liens : elle
demande le CODE de l'email. Les modèles **Confirm signup** et **Reset
Password** doivent donc porter, EN PLUS du lien ci-dessus, une ligne
comme `Ou entrez ce code dans l'application : {{ .Token }}`. Sans elle,
personne ne peut confirmer son adresse ni retrouver son mot de passe
depuis l'app. Le lien et le code sont le même jeton : utiliser l'un
consomme l'autre.

### Sur Vercel — à faire avant le premier déploiement

`.env.local` n'est pas versionné : Vercel ne le reçoit donc **jamais**. Les
deux mêmes variables doivent être saisies dans
**Project Settings → Environment Variables** (Production, Preview et
Development), puis le déploiement relancé.

Sans elles le build **échoue**, avec un message qui nomme les deux
variables. C'est volontaire : un site en ligne dont chaque page plante est
pire qu'un déploiement refusé. Si tu vois cette erreur dans les logs
Vercel, il n'y a rien à corriger dans le code — il manque la
configuration.
