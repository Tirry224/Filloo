# Savoir de testeur

Mémoire de l'agent `testeur`. État ACTUEL ; l'historique est dans
`git log`. Chaque entrée : date, source, constaté ou supposé.

## État de référence (constaté le 2026-10-14, `dev` du site `e76c014`, de l'app `da7cbc9`)

| Suite | Résultat |
|---|---|
| Site — `npm run typecheck` | OK |
| Site — `npm run tests` (Node 22) | 53/53 |
| Site — `npm run gardes`, `npm run classes` | OK |
| Site — `npm run espaces` | **ÉCHEC, 1 cas** (voir « Échecs connus ») |
| Site — `npm run largeurs` | non lancé : exige un serveur sur `localhost:3000` |
| Base — `security_test.sql` | **142 contrôles OK**, « TOUS LES TESTS SONT PASSES » ; **159** avec `0038` (constaté 2026-10-14, branche `claude/traffic-capacity-app-site-grj36p`) |
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
  B=/usr/lib/postgresql/16/bin; D=/var/lib/postgresql/filloo-test
  mkdir -p /var/lib/postgresql && chown postgres /var/lib/postgresql
  su postgres -s /bin/sh -c "rm -rf $D; mkdir -p $D && $B/initdb -D $D/data -A trust >/dev/null && $B/pg_ctl -D $D/data -o \"-k $D -p 54329 -c listen_addresses=''\" -l $D/log start"
  P="psql -h $D -p 54329 -U postgres -q -X"
  $P -c "create database filloo_test" postgres
  $P -v ON_ERROR_STOP=1 -d filloo_test -f supabase/tests/_supabase_stub.sql
  for f in supabase/migrations/*.sql; do $P -v ON_ERROR_STOP=1 -d filloo_test -f "$f" || break; done
  $P -v ON_ERROR_STOP=1 -d filloo_test -f supabase/tests/security_test.sql
  ```
  Si un serveur de test tourne déjà, l'arrêter d'abord
  (`su postgres -s /bin/sh -c "$B/pg_ctl -D $D/data stop -m fast"`),
  sinon le `rm -rf` efface les données sous un serveur vivant.
  Le stub porte un schéma `realtime` minimal (`send`, `topic`,
  `messages`) recopié de la production depuis `0038`.
  Toujours sur une base NEUVE : relancer `security_test.sql` une
  seconde fois sur la même base échoue (« la mesure de 12 mois
  reste… »), à cause des lignes laissées par la première passe — ce
  n'est pas un défaut.
- **Écart de version** : local Postgres 16, production 17 (constaté). Un
  comportement propre à 17 ne se verra pas ici.
- **Chromium** : `/opt/pw-browsers/chromium` (`CHROME=` pour
  `npm run largeurs`, `CHROMIUM=` pour `e2e`).

## Échecs connus

- **`npm run espaces`** (constaté 2026-10-14) :
  `src/app/(client)/(plein-ecran)/compte/informations/supprimer/page.tsx:18`
  renvoie vers `/vendeur/boutique` depuis une route client. Vrai
  mélange d'espaces ou faux positif du script : **à trancher** par le
  porteur du projet.
- **`supabase/tests/README.md` annonce 153 vérifications**, la suite en
  affiche 142 (constaté) : le README est à corriger, ou des contrôles ont
  disparu — à vérifier avec `git log -p supabase/tests/security_test.sql`.

## Jamais testé automatiquement, nulle part

- Temps réel, notifications push (web et app), emails, `next/image`.
  `docs/MEMOIRE.md` : aucune notification n'a encore été constatée reçue.
- L'app mobile en entier : aucun test, aucune exécution dans une session.
  Premiers candidats à un test unitaire (logique pure, sans réseau) :
  `src/lib/format.ts`, `src/lib/telephone.ts`, `src/lib/aiguillage.ts`
  — *supposé, à confirmer à la lecture*.
