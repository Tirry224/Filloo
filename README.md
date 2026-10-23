# Filloo

Marketplace de mise en relation entre commerçants et clients, en Guinée.
Le commerçant publie ses produits, le client les parcourt librement et lui
écrit par la messagerie interne. **Aucun paiement en ligne** : la vente se
conclut hors de l'application.

En ligne sur **https://filloo.net**. L'app mobile vit dans
`tirry224/filloo-mobile`.

## Où lire

- **Reprendre le travail : [`docs/MEMOIRE.md`](docs/MEMOIRE.md)** — état,
  ce qui reste, décisions, pièges.
- [`docs/SPEC.md`](docs/SPEC.md) — les décisions produit, qui font foi.
- [`docs/ECRANS.md`](docs/ECRANS.md) — les écrans et leurs routes.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — les deux espaces et où
  va la logique.
- [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) — les budgets, mesurés.
- [`CLAUDE.md`](CLAUDE.md) — les règles de travail (branches, agents,
  comptes rendus).

## Démarrer

```bash
npm install          # branche aussi le hook pre-commit (historique de MEMOIRE)
npm run dev
```

Les clés publiques (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) sont dans
`.env`, versionné : elles sont faites pour être lues par le navigateur,
c'est le RLS qui protège les données. **Tout secret va dans `.env.local`
et dans Vercel, jamais dans Git.** Sans les variables publiques, le build
échoue avec un message qui les nomme : c'est voulu.

## Vérifier

```bash
npm run typecheck && npm run build
npm run tests        # couche applicative, node --test, sans dépendance
npm run classes      # classes Tailwind qui ne produisent rien
npm run espaces      # étanchéité client / commerçant
npm run gardes       # gardes de route
npm run poids        # budgets de poids
npm run e2e          # parcours Chromium sur une pile Supabase locale (e2e/README.md)
npm run migrations   # migrations du dépôt ↔ production
```

Les règles de sécurité de la base se testent sur un PostgreSQL local :
[`supabase/tests/README.md`](supabase/tests/README.md). **À relancer après
toute modification d'une policy.** Le nombre de contrôles se lit dans la
sortie du script, jamais dans un document.

`npm run migrations` lit la production avec `SUPABASE_ACCESS_TOKEN`
(supabase.com → Account → Access Tokens) dans `.env.local` : ce jeton
ouvre tous les projets du compte. Sans lui :
`npm run migrations -- --json liste.json`.

## Variables de production (Vercel)

À poser dans **Project Settings → Environment Variables**, Production ET
Preview :

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://filloo.net`, sans barre finale : les liens des emails de compte. |
| `SUPABASE_SERVICE_ROLE_KEY` | Contourne le RLS : suppression de compte, écritures protégées, notifications, `/suivi`. Jamais dans le code du navigateur. |
| `VAPID_PRIVATE_KEY` | Signe les notifications navigateur. Quiconque l'obtient peut notifier tous les abonnés. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Aussi dans Vercel, où elle **gagne sur `.env`** : changer de paire, c'est changer les deux, puis redéployer. |
| `CRON_SECRET` | Joint par Vercel aux appels du cron ; sans elle, `/api/quotidien` et `/api/notifications` refusent tout le monde. |
| `OWNER_EMAIL` | La seule connexion (confirmée) qui voit `/suivi` ; sans elle, personne. |
| `SENTRY_DSN` | Erreurs du serveur, filtrées de tout identifiant. |
| `EXPO_ACCESS_TOKEN` | Facultatif : seulement si la sécurité renforcée des notifications Expo est activée. |

## Réglages Supabase (tableau de bord, pas du code)

- **RLS activé sur chaque table** (Database → Tables). Une seule table
  sans RLS rend ses données publiques.
- **Confirm email : activé** (Authentication → Sign In / Providers).
- **SMTP** : Resend, expéditeur `noreply@send.filloo.net` ; SPF, DKIM et
  DMARC chez Cloudflare (ne pas toucher les enregistrements `send` et
  `_dmarc`).
- **Redirect URLs** : `https://filloo.net/**`, Site URL
  `https://filloo.net`.
- **Modèle « Confirm signup »** : lien
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`, plus une
  ligne `{{ .Token }}` pour l'app, qui demande le code au lieu d'ouvrir le
  lien.
- **Modèle « Reset Password »** : lien
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`, plus la
  ligne `{{ .Token }}`. *À constater* sur un téléphone.

## Notifications

- **Navigateur (Web Push)** : la cloche de l'en-tête active ou coupe les
  notifications d'un tap. La demande du navigateur arrive aussi à la
  publication d'un produit et au premier message envoyé. Sur iPhone, il
  faut d'abord ajouter Filloo à l'écran d'accueil.
- **Téléphones de l'app** : Expo (`expo_push_tokens`, `0035`).
- **Plus aucun email de notification** depuis le 2026-10-07 : sans
  notifications activées, on n'est prévenu de rien.
- **Une notification ne recopie jamais le message** : elle s'affiche sur
  un écran verrouillé.
- Le service worker (`public/sw.js`) ne met rien en cache. Le
  désinstaller sur un téléphone : ouvrir le site avec `?sw=off`.
- Ce qui reste en attente se voit en une requête :

```sql
select kind, attempts, last_error, created_at
  from notifications where sent_at is null order by created_at;
```

## Cron du matin

`/api/quotidien`, une fois par jour à 07:00 UTC (`vercel.json`) : envoie
les notifications en attente et efface les photos orphelines. L'offre
Hobby de Vercel refuse tout cron plus fréquent qu'une fois par jour, et
refuse alors **tous** les déploiements.

## Administration

Pas de page d'administration en v1 : masquer un produit, suspendre un
compte ou mettre à la une se fait dans le tableau de bord Supabase. Les
chiffres d'usage se lisent sur `/suivi`. Une boutique est en ligne dès sa
création (`0033`) : il n'y a rien à valider.
