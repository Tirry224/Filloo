# Makiti

Marketplace de mise en relation entre commerçants et clients, en Guinée.
Le commerçant publie ses produits, le client les parcourt librement et le
contacte par messagerie interne. **Aucun paiement en ligne** : la vente se
conclut hors de l'application.

- **Reprendre le travail : [`docs/REPRISE.md`](docs/REPRISE.md)**
- Spécification complète : [`docs/SPEC.md`](docs/SPEC.md)
- Base de données : [`supabase/migrations/`](supabase/migrations/)

## État d'avancement

- [x] Spécification validée
- [x] Schéma de base de données, règles métier et sécurité (RLS)
- [x] Tests de sécurité (153 vérifications, voir `supabase/tests/`)
- [x] Budgets de performance mesurés (`npm run poids`, voir `docs/PERFORMANCE.md`)
- [x] Projet Supabase créé et migrations exécutées
- [x] Design system et bibliothèque de composants (`src/styles/`, `src/components/`)
- [x] Les 36 écrans
- [x] Branchement sur la vraie base, en lecture ET en écriture : catalogue
      public, espace vendeur, messagerie, compte et suppression de compte
- [x] Authentification (inscription, connexion, comptes liés)
- [x] Déploiement Vercel — `main` est la branche de production
- [ ] Parcours complet des écrans dans un navigateur (commencé le 12/09)
- [x] Notification par email des nouveaux messages (code + Resend branché
      sur Vercel — reste à constater un envoi réel dans une vraie boîte)
- [x] Notification par email des décisions d'administration : boutique
      validée, boutique refusée, compte suspendu (`0021` + Vercel Cron)
- [x] SMTP Resend côté Supabase — mot de passe oublié et confirmation
      d'inscription partent par Resend depuis le 2026-09-17
- [ ] `CRON_SECRET` sur Vercel, sans laquelle `/api/notifications` refuse
      tout et aucune décision d'administration n'est annoncée
- [ ] Confirmation d'email à ACTIVER côté Supabase (décidée, le code la
      gère déjà) — possible maintenant que le SMTP fonctionne
- [x] Conditions d'utilisation — texte fourni le 2026-09-17, écran 34
      (`/conditions` et `/vendeur/conditions`), les deux lignes de menu
      mènent enfin quelque part

## Tests

Les règles de sécurité sont couvertes par des tests exécutables sur un
PostgreSQL local : voir [`supabase/tests/README.md`](supabase/tests/README.md).
À lancer après toute modification d'une policy.

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

### Notifications par email (Resend)

Trois variables de plus, **toutes les trois nécessaires** — il en manque
une et aucun email ne part (l'application, elle, continue de marcher) :

```
RESEND_API_KEY=re_...
EMAIL_FROM="Makiti <notifications@ton-domaine.gn>"
NEXT_PUBLIC_SITE_URL=https://ton-domaine.gn
```

- `RESEND_API_KEY` — créée sur [resend.com](https://resend.com), côté
  serveur uniquement (pas de préfixe `NEXT_PUBLIC_`).
- `EMAIL_FROM` — l'adresse d'expédition. **Son domaine doit être vérifié
  chez Resend** (enregistrements DNS SPF et DKIM à poser). Sans domaine
  vérifié, Resend n'accepte d'envoyer qu'à l'adresse du propriétaire du
  compte : suffisant pour un essai, inutilisable en production.
- `NEXT_PUBLIC_SITE_URL` — l'adresse publique du site, **sans barre
  oblique finale**. Elle sert à construire le lien « Répondre » de
  l'email. Elle est lue ici plutôt que déduite de l'en-tête `Host` de la
  requête : un email est ouvert ailleurs et plus tard, son lien doit
  désigner le vrai site.

Ce qui part, et quand : un email au destinataire d'un message, **et
seulement si ce message est le premier non lu de la conversation**. Deux
personnes qui s'écrivent dix fois de suite produisent un seul email ;
le suivant ne repart qu'une fois le fil ouvert. Un rappel de plus
n'apprendrait rien à quelqu'un qui n'est pas revenu, et c'est ainsi
qu'on finit en courrier indésirable.

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

Étapes 1 à 4 faites le 2026-09-19 : l'application est installable, le
service worker existe, les clés sont posées et la table des abonnements
est écrite. **Rien n'est encore envoyé** — il manque l'interrupteur
d'abonnement et l'envoi côté serveur (étapes 5 à 7).

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<déjà dans .env, publique par nature>
VAPID_PRIVATE_KEY=<Vercel uniquement, jamais ici>
```

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — le navigateur la reçoit de toute
  façon : c'est elle qu'il envoie au service de push pour créer un
  abonnement. Elle vit donc dans `.env`, versionné.
- `VAPID_PRIVATE_KEY` — **posée dans Vercel, à ne jamais recopier ici.**
  Quiconque l'obtient peut notifier tous les abonnés au nom de Makiti.
- **La migration `0023` reste À EXÉCUTER** dans Supabase : sans elle, la
  table `push_subscriptions` n'existe pas et l'étape 5 ne peut pas
  commencer.
- **Sur iPhone, le push n'existe que si l'application a été « ajoutée à
  l'écran d'accueil »** — Safari ne l'autorise pas autrement. Sur Android,
  le navigateur suffit.
- **Le service worker ne met RIEN en cache** (`public/sw.js`) : il ne sert
  qu'à recevoir les notifications. Pour le désinstaller partout, vider ce
  fichier et déployer ; pour un seul téléphone, ouvrir l'app avec
  `?sw=off`.

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

**Fait le 2026-09-17** : le SMTP de Resend y est branché et fonctionne.
Avant ça, `/mot-de-passe-oublie` promettait « vous recevrez un lien »
en dépendant du serveur de démonstration de Supabase, que leur propre
documentation donne pour non destiné à la production.

Les valeurs, si c'est à refaire : hôte `smtp.resend.com`, port `465`
(`587` en repli), utilisateur `resend`, mot de passe la clé `re_…`,
expéditeur identique à `EMAIL_FROM` — dont le domaine doit être vérifié
chez Resend.

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
