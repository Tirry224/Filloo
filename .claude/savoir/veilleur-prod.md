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
- **Cron** : `/api/quotidien`, 07:00 UTC (`vercel.json`) ; a besoin de
  `CRON_SECRET` et de la clé `service_role`.

## Dernière mesure

- **2026-10-14** : 5 comptes, 6 messages, base 14 Mo, 3 objets de
  stockage (133 Ko), 15 connexions Postgres sur 60. Migrations
  appliquées jusqu'à `0035` ; `0036`, `0037` en attente.

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
