# Savoir de testeur

Mémoire de l'agent `testeur`. État ACTUEL ; l'historique est dans
`git log`. Chaque entrée : date, source, constaté ou supposé.

## État de référence (constaté le 2026-10-14, `dev` du site `e76c014`, de l'app `da7cbc9`)

| Suite | Résultat |
|---|---|
| Site — `npm run typecheck` | OK |
| Site — `npm run tests` (Node 22) | 56/56 (2026-10-14, avec `erreurs-anonymes`, session principale) |
| Site — `npm run gardes`, `npm run classes` | OK |
| Site — `npm run espaces` | **ÉCHEC, 1 cas** (voir « Échecs connus ») |
| Site — `npm run largeurs` | non lancé : exige un serveur sur `localhost:3000` |
| Base — `security_test.sql` | **183 contrôles OK** avec `0038`–`0040`, « TOUS LES TESTS SONT PASSES » (constaté 2026-10-14, branche `claude/traffic-capacity-app-site-grj36p`) ; 142 sur `dev` sans elles |
| Site — `npm run e2e` | **impossible en session** : pas de démon Docker |
| App — `npm run typecheck` | OK |
| App — `npm run lint` | 0 erreur, 11 avertissements `set-state-in-effect` (connus) |
| App — tests automatiques | **aucun n'existe** |

## Recettes qui marchent dans une session cloud

- **Dépendances** : `npm ci` dans chaque dépôt (absentes au démarrage).
- **Tests de sécurité de la base** (constaté 2026-10-14) : Postgres 16
  est installé (`/usr/lib/postgresql/16/bin`), mais `initdb` refuse de
  tourner en root et le dossier scratchpad devient illisible pour
  l'utilisateur `postgres` en cours de route. Ce qui marche :
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
  Un dossier NEUF à chaque passe (pas de `rm -rf` : un garde-fou de
  suppression le refuse) ; arrêter l'ancien serveur avant, le port est
  le même (`su postgres -s /bin/sh -c "$B/pg_ctl -D <ancien>/data stop -m fast"`).
  Le stub porte un schéma `realtime` minimal (`send`, `topic`,
  `messages`) recopié de la production depuis `0038`.
  Toujours sur une base NEUVE : relancer `security_test.sql` une
  seconde fois sur la même base échoue (« la mesure de 12 mois
  reste… »), à cause des lignes laissées par la première passe — ce
  n'est pas un défaut.
- **Écart de version** : local Postgres 16, production 17 (constaté). Un
  comportement propre à 17 ne se verra pas ici.
- **Prouver que rien de personnel ne part chez Sentry** (constaté
  2026-10-14, session principale, `@sentry/nextjs` 10.76) : faux serveur
  HTTP local sur `127.0.0.1:9999` qui écrit chaque corps reçu (enveloppe),
  `npm run build` puis `SENTRY_DSN=http://cle@127.0.0.1:9999/1 npm start`,
  une route temporaire qui lève (à supprimer après), une requête avec
  cookie, `Authorization`, `X-Forwarded-For` et `?token_hash=…`, puis
  chercher ces valeurs dans le corps reçu. Le test unitaire
  `tests/erreurs-anonymes.test.ts` ne voit que les champs qu'on lui
  donne : il faut aussi y glisser des `breadcrumbs` (fetch Supabase avec
  `data["http.query"]`, console) — `sendDefaultPii:false` ne filtre que
  les clés de la liste du SDK (`token`, `auth`, `cookie`…), pas
  `id=eq.<uuid>` ni un téléphone.
- **Chromium** : `/opt/pw-browsers/chromium` (`CHROME=` pour
  `npm run largeurs`, `CHROMIUM=` pour `e2e`).

## Échecs connus

- **`npm run espaces`** (constaté 2026-10-14) :
  `src/app/(client)/(plein-ecran)/compte/informations/supprimer/page.tsx:18`
  renvoie vers `/vendeur/boutique` depuis une route client. Vrai
  mélange d'espaces ou faux positif du script : **à trancher** par le
  porteur du projet.

## Défauts récurrents

- **Filtre Sentry** (`src/lib/erreurs-anonymes.ts`) : le 2026-10-14,
  les `breadcrumbs` passaient (appels Supabase avec leur requête,
  `console.*`) ; corrigé le même jour, testé. Leçon : tout nouveau champ
  du SDK se vérifie sur le faux serveur, pas seulement au test unitaire.

## Jamais testé automatiquement, nulle part

- Temps réel, notifications push (web et app), emails, `next/image`.
  `docs/MEMOIRE.md` : aucune notification n'a encore été constatée reçue.
- L'app mobile en entier : aucun test, aucune exécution dans une session.
  Premiers candidats à un test unitaire (logique pure, sans réseau) :
  `src/lib/format.ts`, `src/lib/telephone.ts`, `src/lib/aiguillage.ts`
  — *supposé, à confirmer à la lecture*.
