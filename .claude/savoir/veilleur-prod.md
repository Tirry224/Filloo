# Savoir de veilleur-prod

Mémoire de l'agent `veilleur-prod`. État ACTUEL ; l'historique est dans
`git log`. Chaque entrée : date, source, constaté ou supposé. Jamais de
donnée personnelle ici.

## Où regarder

- **Supabase** : projet `bfmsruzyrgbndbueikcb` (`eu-west-3`), offre
  gratuite (constaté 2026-10-14).
- **Vercel** : offre Hobby, *supposé* (compte personnel) ; elle interdit
  l'usage commercial, passage en Pro bloquant avant le premier vrai
  commerçant (`docs/MEMOIRE.md`). Fonctions à Paris (`cdg1`) depuis le
  2026-10-15 : un déploiement en `iad1` est une régression.
- **Site** : `https://filloo.net` (production, branche `main`) ; la
  préversion de `dev` utilise la MÊME base.
- **Vercel, identifiants** : projet `prj_eAGRfpFJ0li6POY2tqq000aGOU6F`,
  équipe `team_SrOwsLKR3AcKEkWzQzFsuO6c` (scope « tiirry ») ; le
  connecteur a répondu 403 puis a marché le 2026-10-14.
- **Sentry** : erreurs du serveur du site seulement, actif en
  production. Pas d'erreurs du navigateur, par choix de poids.
- **Variables (constaté 2026-10-15)** : `VAPID_PRIVATE_KEY` (nouvelle
  paire du 2026-10-15), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `SENTRY_DSN`,
  `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `OWNER_EMAIL`,
  `NEXT_PUBLIC_SITE_URL` en Production ET Preview. Pas
  d'`EXPO_ACCESS_TOKEN` (facultatif).
- **Cron** : `/api/quotidien`, 07:00 UTC (`vercel.json`) ; a besoin de
  `CRON_SECRET` et de la clé `service_role`.

## Dernière mesure

- **2026-10-15** : 1 abonnement web et 1 téléphone de l'app, tous deux
  servis le jour même ; 0 photo orpheline ; 0 notification en attente.

- **2026-10-14** : 5 comptes, 6 messages, base 14 Mo, 3 objets de
  stockage (133 Ko), 15 connexions Postgres sur 60. Migrations
  appliquées jusqu'à `0035`, puis `0040`, `0038` et `0036` le 2026-10-14 ;
  `0039` le 2026-10-15 (SQL Editor, hors `list_migrations`) ; `0037` en attente (constaté, `list_migrations`).
- **2026-10-20** : `0037` appliquée ; `0039` inscrite dans
  `schema_migrations`. L'Action `Migrations` rouge chaque matin depuis sa
  création : secret `SUPABASE_ACCESS_TOKEN` absent, aucune comparaison
  faite.

## Problèmes connus (ne pas re-signaler comme nouveaux)

- **Notifications distribuées depuis le 2026-10-15** (web push et app,
  `last_used_at` rempli). Un `last_used_at` qui cesse d'avancer alors
  que des messages arrivent est le signe d'une panne.
- **Cron du matin** : pas de journal de réussite vu, mais aucune photo
  orpheline ni notification en attente en base le 2026-10-15.
- **Alertes Supabase connues au 2026-10-14** : 15 fonctions
  `SECURITY DEFINER` ouvertes à `anon`, protection des mots de passe
  fuités désactivée, bucket `product-images` sans limite (détail :
  `.claude/savoir/gardien-base.md`).

## Motifs appris

- (vide — à remplir au fil des bilans : erreurs récurrentes bénignes,
  signatures de vraies pannes.)
