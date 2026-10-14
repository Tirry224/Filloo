# Savoir de veilleur-prod

Mémoire de l'agent `veilleur-prod`. État ACTUEL ; l'historique est dans
`git log`. Chaque entrée : date, source, constaté ou supposé. Jamais de
donnée personnelle ici.

## Où regarder

- **Supabase** : projet `bfmsruzyrgbndbueikcb` (`eu-west-3`), offre
  gratuite (constaté 2026-10-14).
- **Vercel** : compte personnel, aucune équipe (constaté 2026-10-14) —
  donc offre Hobby, *supposé*. Identifiant du projet : à trouver avec
  `list_projects` au premier bilan et à noter ici.
- **Site** : `https://filloo.net` (production, branche `main`) ; la
  préversion de `dev` utilise la MÊME base.
- **Vercel, identifiants** : projet `prj_eAGRfpFJ0li6POY2tqq000aGOU6F`,
  équipe `team_SrOwsLKR3AcKEkWzQzFsuO6c` (scope « tiirry ») ; le
  connecteur a répondu 403 puis a marché le 2026-10-14.
- **Sentry** : erreurs du serveur du site seulement. `SENTRY_DSN` posée
  le 2026-10-14 pour Production SEULEMENT, et `main` n'a pas encore le
  code : actif nulle part ce jour-là. Pas d'erreurs du navigateur, par
  choix de poids.
- **Variables absentes ou partielles (2026-10-14, constaté)** : pas de
  `VAPID_PRIVATE_KEY` ni d'`EXPO_ACCESS_TOKEN` (ce dernier facultatif) ;
  `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `OWNER_EMAIL` en
  Production seulement.
- **Cron** : `/api/quotidien`, 07:00 UTC (`vercel.json`) ; a besoin de
  `CRON_SECRET` et de la clé `service_role`.

## Dernière mesure

- **2026-10-14** : 5 comptes, 6 messages, base 14 Mo, 3 objets de
  stockage (133 Ko), 15 connexions Postgres sur 60. Migrations
  appliquées jusqu'à `0035`, puis `0040` et `0038` le 2026-10-14 ;
  `0036`, `0037`, `0039` en attente (constaté, `list_migrations`).

## Problèmes connus (ne pas re-signaler comme nouveaux)

- **Aucune notification n'a jamais été constatée distribuée** (web push
  et app) — `docs/MEMOIRE.md`, au 2026-10-02. Signe de guérison :
  `last_used_at` qui avance.
- **Cron du matin jamais constaté réussi** (`CRON_SECRET` déclaré posé
  le 2026-10-02, non vérifié).
- **Alertes Supabase connues au 2026-10-14** : 15 fonctions
  `SECURITY DEFINER` ouvertes à `anon`, protection des mots de passe
  fuités désactivée, bucket `product-images` sans limite (détail :
  `.claude/savoir/gardien-base.md`).

## Motifs appris

- (vide — à remplir au fil des bilans : erreurs récurrentes bénignes,
  signatures de vraies pannes.)
