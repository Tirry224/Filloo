# Savoir de testeur

Mémoire de l'agent `testeur`. État ACTUEL ; l'historique est dans
`git log`. Chaque entrée : date, source, constaté ou supposé.

## État de référence (constaté le 2026-10-23, `dev` du site)

| Suite | Résultat |
|---|---|
| `npm run typecheck`, `npm run build` | OK |
| `npm run tests` (Node 22) | **55/55**, 9 fichiers |
| `npm run classes`, `npm run gardes` | OK |
| `npm run espaces` | OK depuis le 2026-10-23 (la suppression a sa route commerçant) |
| `npm run poids` | OK (socle 169,4 Ko, police 19,7 Ko, HTML ≤ 12,1 Ko) |
| `npm run largeurs` | non lancé : exige un serveur sur `localhost:3000` |
| `security_test.sql` | **183 contrôles OK** (2026-10-14, avec `0038`–`0040`) |
| `npm run e2e` | **impossible en session** : pas de démon Docker |
| App — `npm run typecheck` / `lint` | OK / 11 avertissements connus (2026-10-14) |
| App — tests automatiques | **aucun n'existe** |

## Recettes qui marchent dans une session cloud

- **Dépendances** : `npm ci` dans chaque dépôt (absentes au démarrage).
- **Clone partiel** : `git fetch --unshallow` avant le premier commit,
  sinon le hook `pre-commit` (`npm run memoire`) refuse.
- **Tests de sécurité de la base** (Postgres 16 installé ; `initdb`
  refuse root) :
  ```bash
  B=/usr/lib/postgresql/16/bin; D=/var/lib/postgresql/filloo-test-$(date +%s)
  mkdir -p /var/lib/postgresql && chown postgres /var/lib/postgresql
  su postgres -s /bin/sh -c "mkdir -p $D && $B/initdb -D $D/data -A trust >/dev/null && $B/pg_ctl -D $D/data -o \"-k $D -p 54329 -c listen_addresses=''\" -l $D/log start"
  P="psql -h $D -p 54329 -U postgres -q -X"
  $P -c "create database filloo_test" postgres
  $P -v ON_ERROR_STOP=1 -d filloo_test -f supabase/tests/_supabase_stub.sql
  for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 -d filloo_test -f "$f" || break; done
  $P -v ON_ERROR_STOP=1 -d filloo_test -f supabase/tests/security_test.sql
  ```
  Un dossier NEUF à chaque passe (pas de `rm -rf`, refusé par un
  garde-fou) ; arrêter l'ancien serveur avant, le port est le même.
  Relancer le script sur la même base échoue : ce n'est pas un défaut.
  Écart de version : local 16, production 17.
- **Prouver que rien de personnel ne part chez Sentry** : faux serveur
  HTTP sur `127.0.0.1:9999`, `SENTRY_DSN=http://cle@127.0.0.1:9999/1
  npm start`, une route temporaire qui lève, une requête avec cookie,
  `Authorization` et `?token_hash=…`, puis chercher ces valeurs dans le
  corps reçu. Le test unitaire seul ne voit pas les `breadcrumbs`.
- **Chromium** : `/opt/pw-browsers/chromium` (`CHROME=` pour
  `npm run largeurs`, `CHROMIUM=` pour `e2e`).

## Échecs connus

- Aucun au 2026-10-23.

## Défauts récurrents

- **Une classe Tailwind inexistante passe typecheck, build et tests** :
  le 2026-10-23, `shadow-lg` de la cloche n'a été vue que par
  `npm run classes`. Le lancer avant chaque push qui touche des classes.
- **Filtre Sentry** : tout nouveau champ du SDK se vérifie sur le faux
  serveur, pas seulement au test unitaire.

## Jamais testé automatiquement

- Temps réel, notifications (web et app), emails, `next/image`.
- **La cloche et la demande de notifications au bon moment**
  (2026-10-22, 2026-10-23) : aucune exécution dans un navigateur ;
  Playwright peut accorder la permission (`context.grantPermissions`)
  pour un futur test e2e.
- **La suppression d'un seul compte lié** (2026-10-23) : `supprimerProfil`
  appelle le client `admin` sans injection possible, donc aucun test
  unitaire ; candidat e2e (pile locale) : créer client + boutique,
  supprimer l'un, vérifier que l'autre entre sans reconnexion.
- L'app mobile en entier. Premiers candidats à un test unitaire :
  `src/lib/format.ts`, `src/lib/telephone.ts` — *supposé*.
