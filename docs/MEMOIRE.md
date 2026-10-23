# Mémoire de Filloo

Point d'entrée pour reprendre le projet. Réécrit le **2026-10-23** :
mis à jour et raccourci ; l'ancienne version se relit par
`git log -p -- docs/MEMOIRE.md`.

## Comment ce fichier marche

- **Tout ce qui précède « Évolution, commit par commit » s'écrit à la
  main** : ce qui reste, ce qui est en place, ce qui est tranché, ce qui
  a déjà fait mal. Git ne sait pas le dire.
- **L'historique est généré** par `npm run memoire`, lancé seul par le
  hook `.githooks/pre-commit` (branché par `npm install` ; vérifier que
  `git config core.hooksPath` répond `.githooks`). Il refuse un clone
  partiel : `git fetch --unshallow` d'abord.
- **À chaque commit qui ferme un point, en ouvre un ou enseigne quelque
  chose, mettre à jour la section concernée.** Aucune machine ne le sait.
- **Citer une section par son TITRE**, jamais par un numéro.
- **Les migrations citent encore l'ancien `docs/REPRISE.md`** et ne se
  corrigent pas (une migration appliquée ne se réécrit pas) :
  `git show <empreinte>:docs/REPRISE.md` le relit à leur date.
- **« À constater »** marque ce qu'une session ne peut pas vérifier
  (production, téléphone, boîte mail) : ni fait, ni cassé.

## État au 2026-10-23

- **En ligne sur `https://filloo.net`** (`main`, Vercel, fonctions à
  Paris), préversion sur `dev` avec **la même base**.
- **Base** : 41 migrations, toutes appliquées en production (constaté
  le 2026-10-23). 5 boutiques, 2 produits, 17 messages, 15 Mo de base,
  0,8 Mo de photos (2026-10-22).
- **Parcours vus marcher sur téléphone** (2026-10-15) : inscription
  commerçant jusqu'à la boutique en ligne, photo, messagerie,
  notifications navigateur et app, application fermée.
- **App mobile** dans `tirry224/filloo-mobile`, versions de test
  seulement, rien sur les stores.

---

## Ce qui reste à faire

### Bloquant avant de vrais commerçants

- **Vercel Hobby interdit l'usage commercial** ; une marketplace en
  relève probablement, même gratuite. Risque de suspension, qui
  couperait aussi l'API de l'app. Passer en Pro (~20 $/mois).
- **La base n'a aucune sauvegarde.** Une erreur efface tout pour de bon.
  Supabase Pro (~25 $/mois, sauvegarde quotidienne) ou une sauvegarde
  automatique gratuite (tâche GitHub `pg_dump`, à écrire).
- **« Mot de passe oublié » n'est pas prouvé.** Le modèle d'email
  « Reset Password » doit porter
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`.
  *À constater* : demander le lien sur un téléphone, l'ouvrir depuis
  l'app Mail.

### Décidé par le porteur du projet (2026-10-23), à faire

- **Au premier seuil de 50 % d'une limite gratuite, passer en Supabase
  Pro.** La surveillance hebdomadaire le dira (voir « Surveillance »).
- **Photos plus légères** (1024 px, ~60 Ko au lieu de 95) : proposé, non
  décidé. Exige aussi une version de l'app.
- **Photos vers Cloudflare R2** seulement quand le stockage deviendra la
  limite (~3 000 produits). Plan : R2 + adresse dédiée, envoi par une
  route du site qui vérifie le propriétaire, lecture aux deux endroits
  pendant la transition, copie des anciennes, puis fermeture de l'ancien
  envoi. Les photos sont stockées par chemin : la base ne change pas.

### À constater sur un téléphone

- **Supprimer un seul des deux comptes liés** (2026-10-23) : l'autre
  reste accessible sans se reconnecter, ses conversations et
  notifications intactes. Jamais testé en vrai : à faire avec un compte
  de test, la préversion écrivant dans la base de production.

- **La cloche** (2026-10-22) : un tap active, un second coupe ; bulle
  d'explication si le navigateur ne gère pas ou a bloqué.
- **La demande de notifications au bon moment** (2026-10-23) : à
  « Publier le produit » et au premier message envoyé, une fois par
  occasion et par appareil ; acceptée, l'appareil s'abonne seul.
- **Photo de profil d'une boutique** sur la page publique, la fiche, les
  résultats et la messagerie.
- **Son d'un message reçu sur iPhone** (l'interrupteur silencieux le
  coupe, c'est voulu) ; **badge de non-lus** qui s'éteint à l'ouverture
  d'un fil.

### À décider

- **Sentry dans l'app**, **captcha à l'inscription** (Cloudflare
  Turnstile est gratuit).
- **Mesures d'usage de l'app** : `analytics_events` ne s'écrit qu'avec la
  clé `service_role` ; une route ouverte laisserait fabriquer des
  chiffres.
- **L'app supprime encore les deux comptes d'un coup** : sans `role`,
  `/api/app/supprimer-compte` garde l'ancien comportement pour les
  téléphones installés. Une version de l'app qui envoie `role`
  (`"client"` ou `"merchant"`) suivra le site.
- **L'app ne vérifie peut-être pas le chiffre** exigé depuis le
  2026-10-23 : à aligner dans `filloo-mobile`.
  Pour que Supabase exige aussi le chiffre, cocher « letters and digits »
  dans Authentication → Sign In / Providers → Email (porteur du projet).
- **Messages d'erreur réécrits courts le 2026-10-23**, sauf ceux des
  triggers de la base (`raise exception`, code P0001), affichés tels quels
  : les changer demande une migration.
- **L'app après `0041`** : une lecture de `profiles` par rôle sans filtre
  `is_deleted = false` (ou en `.single()`) recevra deux lignes après une
  recréation. À vérifier dans `filloo-mobile` avant de mettre en
  production la recréation côté site.
- **On peut se signaler soi-même** : la policy « reports: je signale »
  vérifie le signalant, pas la cible. Migration à écrire, sur accord.
- **Préchargement des liens** : `docs/PERFORMANCE.md` annonçait
  `prefetch={false}` sur tous les liens de liste ; le code n'en porte
  aucun (constaté le 2026-10-23). Poser la règle ou la retirer.

### Ménage, non bloquant

- **Projet Supabase « Fillo »** (2026-08-25) : tourne à côté de `Filloo`,
  on ne sait pas s'il sert.
- **Branches `claude/*` sur GitHub** : à supprimer depuis une machine où
  `git` parle directement à GitHub (le relais des sessions refuse,
  403), jamais sans accord.
- **Google Search Console** : déclarer `filloo.net`, soumettre
  `/sitemap.xml` (porteur du projet).
- **`/suivi` compte encore les « boutiques en attente »**, toujours 0
  depuis `0033`.

### Dettes techniques connues

- **`merchants.status` est un vestige** : figé à `'approved'` par
  `merchants_always_approved` (`0033`), mais lu par les policies RLS.
- **`profiles.city_id`** n'est plus lu par le site (2026-10-22) mais
  l'app installée l'écrit encore. Le retirer attend une app qui ne le
  touche plus.
- **`messages` reste publiée en `postgres_changes`** pour les apps de
  test ; la retirer quand aucune ne l'écoute (le canal privé `0038`
  suffit au site).
- **`browser-image-compression` charge son worker depuis
  `cdn.jsdelivr.net`** à chaque photo (`useWebWorker: true`). Bloqué, il
  retombe sur le fil principal. À trancher : servir le script depuis
  Filloo, ou `useWebWorker: false`.
- **Le dépôt et la production n'ont pas les mêmes commentaires SQL** (le
  mécanisme d'application les retire) : comparer
  `md5(pg_get_functiondef())` donne des faux positifs.
- **Le commentaire de `0023` est faux** ; une migration appliquée ne se
  corrige pas.
- **`security_test.sql`** : le bloc du quota des 100 messages/jour
  affiche `OK` sans vérifier le `sqlstate`.
- **`middleware` est déprécié en Next 16** :
  `npx @next/codemod@canary middleware-to-proxy .`.
- **Un prix de 0 GNF est accepté** ; rien ne dit si c'est voulu.
- **Les bannières `?erreur=` et `?info=` affichent tout texte mis dans
  l'adresse** (sans exécuter de script).
- **`npm run tests` ne trouve rien sous Windows** (guillemets de
  `'tests/*.test.ts'`) : lancer depuis Git Bash.
- **La couche applicative n'est testée que par ses parcours** (`npm run
  e2e`, pile Supabase locale, Docker requis, pas en CI).
- **Le parcours vers le compte lié ne se trouve pas seul** : le porteur
  du projet lui-même a créé deux connexions au lieu d'un profil lié.

---

## Ce que Filloo est

Une marketplace de **mise en relation** en Guinée : les commerçants
publient, les clients parcourent et écrivent au vendeur. **Aucun
paiement, aucun panier, aucune livraison** : la vente se conclut en main
propre. Le système ne sait donc jamais qu'une vente a eu lieu — d'où
**aucune notation**, invérifiable. GNF en entiers, français.

---

## Ce qui est en place

### Base

- **41 migrations**, `supabase/migrations/`. Tests de sécurité :
  `supabase/tests/security_test.sql`, rejouables en local (183 contrôles
  au vert le 2026-10-14 ; le nombre se relit dans la sortie, pas ici).
- **Buckets** `product-images` et `shop-photos` : 1 Mo, WebP ou JPEG.
  Photos que plus aucun produit ne cite effacées après 24 h.
- **Un compte supprimé est anonymisé, jamais effacé** : ses messages
  restent lisibles par l'autre partie, son email est libéré
  (`supprime-<id>@filloo.invalid`).
- **Écritures protégées par mot de passe** (nom, téléphone, boutique)
  passées par le serveur (`0036`, `0037`, `src/lib/ecritures-protegees.ts`),
  y compris pour l'app (`/api/app/mes-informations`, `/api/app/ma-boutique`).

### Site — Next.js 16, React 19, TypeScript, Tailwind 4

- **Deux espaces étanches** (client, commerçant), décrits dans
  `docs/ARCHITECTURE.md`.
- **Catalogue sans filtre de ville** (2026-10-22) : accueil et recherche
  couvrent toute la Guinée ; la ville de la boutique s'affiche sur la
  carte. Le client ne renseigne plus de ville.
- **Notifications** : Web Push (`public/sw.js`, `0023`) et téléphones de
  l'app (Expo, `0035`), plus d'email de notification depuis le
  2026-10-07. **La cloche de l'en-tête** (accueils client et commerçant)
  est le seul réglage depuis le 2026-10-23. Une suspension ne s'annonce
  pas en clair sur un écran verrouillé.
- **Temps réel par canal privé** `user:<uid>` (`0038`), son et bandeau à
  chaque message reçu (`MessageAlerts`).
- **Produit vendu remis en vente** depuis sa feuille d'actions
  (2026-10-22).
- **Inscription boutique** : le WhatsApp reprend le numéro du compte.
- **Chaque compte lié se supprime seul** (2026-10-23) : une route par
  espace (`/compte/…/supprimer`, `/vendeur/informations/supprimer`),
  `supprimerProfil` dans `src/lib/suppression-compte.ts`. La connexion
  n'est fermée, et l'email libéré, qu'avec le dernier compte. Le site
  ignore les profils supprimés (`getMyProfiles`). **Un compte supprimé se
  recrée** (`0041`, APPLIQUÉE le 2026-10-23 par le connecteur, accord du
  porteur du projet) : unicité seulement sur les profils actifs,
  `my_profile_id` ignore les supprimés, et un compte SUSPENDU puis supprimé
  ne se recrée pas (`my_role_is_suspended`).
- **Cache** : catalogue public lu une minute par le client anonyme ;
  une page visitée reste 30 s dans le navigateur ; photos servies par
  `next/image`.
- **Erreurs du serveur dans Sentry**, filtrées de tout identifiant
  (`src/lib/erreurs-anonymes.ts`). Pas de Sentry navigateur (+72 Ko).
- **`/suivi`** : tableau de bord du porteur du projet (`OWNER_EMAIL`),
  404 pour tous les autres.
- **SEO** : titre par page, image de partage, données `Product`,
  sitemap sans produits vendus.

### Déploiement, surveillance et commandes

- **Vercel** : `main` en production, `dev` en préversion, région `cdg1`
  (la base est à Paris : ne pas changer l'un sans l'autre). Cron
  `/api/quotidien` à 07:00 UTC (notifications en attente, ménage des
  photos).
- **Emails de compte** par Resend, depuis `noreply@send.filloo.net`.
- **Surveillance hebdomadaire** (2026-10-23) : tâche planifiée
  `trig_015DkshW2gbcjy1WPZ4DebYM`, le lundi 07:58 heure de Conakry,
  lecture seule ; alerte au-delà de 50 % d'une limite gratuite. **Elle
  n'a pas encore les connecteurs Supabase et Vercel** : à ajouter par le
  porteur du projet sur claude.ai, sans quoi elle ne mesure rien.
- **Action GitHub `Migrations`** : compare dépôt et production ; exige
  le secret `SUPABASE_ACCESS_TOKEN`, absent au 2026-10-20 (elle échoue
  chaque matin sans rien comparer).

```bash
npm install && npm run dev     # nécessite .env.local — voir README
npm run typecheck && npm run build
npm run tests                  # 55 tests, node --test
npm run classes                # classes Tailwind fantômes
npm run espaces                # étanchéité des deux espaces
npm run gardes                 # gardes de route
npm run poids                  # budgets (docs/PERFORMANCE.md)
npm run largeurs               # débordements, serveur sur :3000
npm run e2e                    # parcours Chromium, pile locale (e2e/README.md)
npm run migrations             # dépôt ↔ production
npm run memoire                # régénère l'historique de ce fichier
```

---

## Décisions prises — ne pas les rediscuter

`docs/SPEC.md` fait foi ; rappel de ce qu'une session ne rouvre pas.

- **Catalogue ouvert sans compte** ; compte exigé pour écrire.
- **Un fil par couple (client, boutique)**, premier message citant un
  produit.
- **Deux comptes liés derrière une connexion**, jamais mélangés sur un
  écran.
- **Boutique en ligne dès sa création** (`0033`, 2026-10-02) : ni
  validation ni refus ; suspension et suppression restent les seuls
  retraits.
- **Seule la boutique a une ville** (2026-10-22) ; aucun filtre de ville.
- **Notifications proposées au moment utile** (publication, premier
  message), jamais à l'inscription ni au chargement (2026-10-23).
- **Neuf catégories, douze villes** (2026-09-23) : rien ne bouge sans un
  besoin constaté chez un commerçant.
- **Publication immédiate**, signalement, masquage par l'administrateur.
- **Disponible ou vendu**, pas de stock ; un vendu se remet en vente.
- **La suspension coupe l'écriture, jamais la lecture, dans les deux
  sens** (`0017`, `0022`).
- **Un blocage ferme le fil dans les deux sens ; seul le bloqueur le
  lève** (`0032`).
- **On ne contacte pas sa propre boutique** (le compteur sert au tri).
- **L'intention survit à l'authentification** : `?next=`, validé par
  `safeNextPath` seul.
- **Conservation** : mesures 13 mois, photos orphelines 24 h ; messages,
  signalements et comptes anonymisés sans limite, en attendant un avis
  sur la loi guinéenne L/2016/037.
- **Pas de notation, aucune monétisation en v1.**
- **App native iPhone et Android** dans son propre dépôt, même base,
  aucun code partagé ; ce qui exige un secret passe par `/api/app/*`.
- **Direction visuelle « A — Marché »** : fond papier chaud, terre cuite,
  bordures plutôt qu'ombres.

### Règles de travail

- **`dev` pour travailler, `main` pour la production** : `CLAUDE.md` fait
  foi.
- **Une migration appliquée ne se réécrit jamais**, et toute migration
  appliquée est commitée dans la même session.
- **Relancer les tests de sécurité après TOUTE modification de policy.**

---

## Pièges rencontrés — à ne pas refaire

Chaque ligne a coûté du temps.

### Sécurité et SQL

- **Révoquer une colonne ne sert à rien si `UPDATE` existe sur la
  table** (défaut Supabase) : révoquer la table, ré-accorder colonne par
  colonne.
- **Le RLS filtre des lignes, jamais des colonnes** : les deux questions
  se posent à chaque table.
- **Le RLS ne se teste pas avec un accès qui le contourne** : rejouer en
  `set role anon`.
- **Un avertissement de sécurité se vérifie dans les deux sens** : sur
  onze signalés, sept faux positifs, une vraie fuite.
- **Toute fonction `security definer` vérifie QUI demande**, pas
  seulement ce qu'on lui demande : un identifiant difficile à deviner
  n'est pas une protection.
- **Un confort administratif rouvre les failles** : `security invoker`
  s'écrit en clair pour que ce soit un choix visible.
- **Quand le modèle change, les protections de l'ancien deviennent
  décoratives** sans qu'aucun test ne le dise.
- **Une règle posée sur la table A ne voit pas les écritures sur B** :
  une protection se vérifie sur le chemin réel du code.
- **Commitée n'est pas appliquée, et appliquée n'est pas commitée** :
  `npm run migrations` compare les deux, avant de pousser une migration.
  Une migration passée au SQL Editor s'inscrit à la main dans
  `schema_migrations`.

### Couche applicative

- **Un abonnement temps réel lancé avant la session rejoint en `anon`**
  et ne reçoit rien, sans erreur : poser le jeton AVANT `subscribe()`.
- **« Pas d'erreur » ne veut pas dire « fait »** : un `update` ou
  `delete` écarté par le RLS réussit à zéro ligne ; seul
  `.select("id")` le dit.
- **Une action dont on ne sait pas si elle a réussi est cassée**, même
  quand elle marche.
- **Une écriture pendant un rendu n'atteint pas le layout en cache** :
  passer par une action et `revalidatePath`.
- **Supprimer puis réinsérer les photos dépubliait le produit** : se
  réécrivent position par position.
- **Une liste blanche de préfixes valide une orthographe, pas une
  adresse** : analyser l'adresse comme le fera le navigateur.
- **`auth.getUser()` est un aller-retour réseau** : session, profils et
  client en cache par requête.
- **Une classe Tailwind inexistante ne produit aucune erreur** :
  `npm run classes` (encore utile le 2026-10-23).
- **`Number()` ne lit pas un montant humain** : « 450.000 » devenait
  450. Une saisie se lit avec la règle du format (`src/lib/prix.ts`).
- **React 19 vide un `<form action>` après chaque envoi, erreur
  comprise** : tout formulaire passe par `useFormulaire`, qui garde la
  saisie, survit à une coupure et bloque le double envoi.
- **Le middleware ne redirige jamais une action serveur.**
- **Un squelette qui ne ressemble pas à la page la fait sauter**, et un
  `loading.tsx` de dossier prend le pas sur celui du parent.
- **Un navigateur ne repose plus la question des notifications** après
  un refus ou plusieurs fermetures : la poser une fois, au moment utile.

### Supabase Auth

- **Un réglage du tableau de bord se recopie dans le code, ou les deux
  mentent** : Supabase exigeait 10 caractères, le site 8 ; six
  inscriptions refusées le 2026-10-22 avec « 8 caractères minimum ». Le
  site lit désormais le chiffre dans la réponse (`src/lib/erreurs-auth.ts`).
  Supabase remis à 8 le 2026-10-23, `LONGUEUR_MIN_MOT_DE_PASSE` aussi. Les journaux
  d'authentification (`auth_logs`) disent le vrai refus.
- **« Faux » n'est pas « incorrect »** : la vérification du mot de passe
  répondait faux pour un « trop d'essais » comme pour un mauvais mot de
  passe. `refusMotDePasse` distingue les deux.

- **`signOut()` sans argument est GLOBAL** : il déconnecte tous les
  appareils.
- **Un client « isolé » ne l'est que pour ce qu'il stocke.**
- **Le lien PKCE (`?code=`) ne vit que dans le navigateur qui l'a
  demandé** : pour un lien d'email, `token_hash` + `verifyOtp`.

### Méthode

- **Le connecteur Supabase attend une confirmation avant tout `drop`,
  qui n'arrive jamais en session** : la migration passe par le SQL
  Editor. Relire l'état après un délai dépassé.
- **Une session peut s'ouvrir sur une branche périmée** : `git fetch`
  puis repartir de `dev` avant de lire quoi que ce soit.
- **Un clone partiel cache l'histoire** (50 commits).
- **Regarder trouve ce que les tests ne voient pas** : le premier
  passage sur téléphone a trouvé quatre défauts en quelques minutes.
- **Un document écrit au passé avant le code ment** : une intention
  s'écrit au futur. Le 2026-10-23, `docs/PERFORMANCE.md` affirmait des
  règles que le code n'appliquait pas.
- **Une constatation d'une session ancienne se revérifie** : le
  2026-10-22, une « boutique refusée » a été signalée comme un défaut
  alors que `0033` avait supprimé le refus.
- **Une décision en plusieurs clauses se vérifie clause par clause.**
- **Un service worker mal retiré survit à son application** : prévoir
  sa désinstallation dès qu'il mettra en cache.

---

## Où lire le reste

- `CLAUDE.md` — la règle Git, les agents, la forme des comptes rendus.
- `docs/SPEC.md` — les décisions produit, qui font foi.
- `docs/ECRANS.md` — les écrans et leurs routes.
- `docs/ARCHITECTURE.md` — les espaces, les gardes, où va la logique.
- `docs/PERFORMANCE.md` — les budgets, mesurés.
- `.claude/savoir/` — la mémoire de chaque agent.
- `supabase/tests/README.md` — rejouer les tests de sécurité.

---

## Le vrai risque

Le code est presque fait. **Recruter les vingt premiers commerçants, sur
un seul marché, est le travail le plus difficile du projet**, et il ne
s'écrit pas en TypeScript.

---

## Évolution, commit par commit

<!-- DEBUT HISTORIQUE — généré par `npm run memoire`, ne pas éditer à la main -->

343 commits, du plus récent au plus ancien.

### 2026-10-23

- `8111c24` 0041 : savoir de gardien-base et README des tests (194 contrôles)
- `73a4bfd` 0041 (brouillon) : tests de sécurité en cours d'écriture — NON APPLIQUÉE
- `40c4c8c` 0041 (brouillon) : recréer un profil supprimé — EN COURS, NON APPLIQUÉE
- `c1171f1` Recréer un compte supprimé : côté site (attend la migration 0041)
- `a142edb` Mot de passe : 8 caractères, comme Supabase désormais
- `5f78dc8` Messages d'erreur courts, et un chiffre exigé dans le mot de passe
- `7ed2202` Mot de passe : les messages d'échec disent enfin la vraie cause
- `3b535b6` Textes d'attente et placeholders sans points de suspension
- `5a25296` Mot de passe affichable, et textes de formulaire corrigés
- `a23389c` Supprimer un compte lié ne supprime plus l'autre
- `4dbfb1c` Documentation réécrite : à jour, et deux fois plus courte
- `f615fc9` Cloche : retire une classe d'ombre qui n'existe pas
- `d332da1` Notifications proposées au bon moment, plus à l'inscription
- `e35c15f` Notifications : actives dès l'inscription, la cloche seul réglage

### 2026-10-22

- `0047d44` Le WhatsApp de la boutique reprend le numéro du compte
- `2563e18` Une cloche dans l'en-tête active ou coupe les notifications d'un tap
- `24c9c8b` La recherche n'a plus de filtre de ville
- `abf3867` Le catalogue n'est plus filtré par la ville du client
- `7ea6317` Merge branch 'claude/zen-ptolemy-w14gzr' into dev
- `cdf6ec4` Un produit vendu peut être remis en vente sans le supprimer

### 2026-10-20

- `25068af` Base : 0037 appliquée, 0039 inscrite dans l'historique, secret de l'Action manquant

### 2026-10-18

- `4f17748` Retire l'icône fourmi de dev : elle reste en travail sur claude/app-official-colors-6zqfnj
- `1bd6676` Icônes du site : la fourmi mascotte indigo dans un disque mangue
- `f2fc9d5` Merge branch 'claude/app-official-colors-6zqfnj' into dev
- `775936d` Couleurs : la palette officielle de Filloo remplace la terre cuite

### 2026-10-15

- `99d5140` Documentation et savoirs : état du 2026-10-15 (notifications, variables Vercel, cron, ménage)
- `bfb3876` Mémoire : état du 2026-10-15, diagnostics résolus retirés, bloquants réels avant le premier commerçant
- `4b30e96` Mémoire : parcours commerçant, photo, messagerie et notifications constatés sur téléphone
- `68b8dcc` SEO : le sitemap n'annonce plus les produits vendus
- `1e0e3f6` SEO : données structurées Product (prix en GNF, disponibilité) sur chaque fiche
- `90bc332` SEO : un titre par page avec la marque, recherches et accueil filtré non indexés
- `32a76cd` SEO : image de partage pour filloo.net, budget HTML à 13 Ko
- `9bbb1cc` Discussions : l'écoute temps réel se charge après l'affichage du fil
- `8c13a73` Formulaires photo : le compresseur et le client Supabase se chargent au choix d'une photo
- `7c0080f` Ménage : pages de travail /styleguide et /ecrans supprimées, motifs de signalement dans leur propre fichier
- `83041e5` Ménage : le jeu de fausses boutiques (seed_demo.sql) est supprimé
- `9f7e94d` Ménage : données de démonstration et formatPhone inutilisés retirés
- `19bb58d` Ménage : scripts/parcours.mjs retiré, remplacé par e2e/ et ne tournait plus
- `6adf6b5` Navigation : une page visitée reste 30 s dans le navigateur
- `91cf22f` Messages : la bulle apparaît dès l'appui sur Envoyer, en « Envoi… »
- `39c011c` Serveur à Paris, à côté de la base : chaque requête ne traverse plus l'Atlantique
- `6d463fc` Mémoire : la paire VAPID est posée dans Vercel, et la clé publique de Vercel gagne sur .env
- `40f2e46` Notifications navigateur : nouvelle paire VAPID, l'ancienne clé privée est perdue

### 2026-10-14

- `7289841` Merge pull request #6 from Tirry224/dev

### 2026-10-15

- `3082c2e` Fusion de main dans dev : préparer la mise en production
- `86fb520` Essai Sentry : retrait de la route d'erreur volontaire avant la production
- `37e421e` 0039 appliquée par le SQL Editor, constatée dans la base

### 2026-10-14

- `7d45fa1` 0036 appliquée : fonctions d'écriture protégée, 0037 et 0039 en attente
- `5a635ee` Mémoire : VAPID_PRIVATE_KEY absente de Vercel, variables de la préversion
- `fb691a6` Essai Sentry : route d'erreur volontaire, préversion seulement (temporaire)
- `a226d52` Suivi des erreurs du serveur : Sentry, inactif sans SENTRY_DSN
- `e2ea853` Savoirs : 0038 et 0040 appliquées, 0039 en attente
- `98fd6bb` Savoir gardien-base : état réel des migrations après le 2026-10-14
- `2ed568a` Mémoire : la montée en charge du 2026-10-14, et deux pièges
- `f5e46dd` Catalogue : fiche produit et page boutique lues depuis le cache
- `e9ee4e9` 0038 appliquée : telle qu'en production, sans drop ni apostrophe accentuée
- `4f8e8ee` Savoir relecteur-compat : 0039 et 0040 relues compatibles, photos envoyées
- `6524004` Base : règles d'accès évaluées une fois par requête, photos limitées (0039, 0040, non appliquées)
- `8891d06` Temps réel : un changement de compte rapide n'écoute plus l'ancien canal
- `f301e19` Base : chacun n'entend que ses propres messages (0038, non appliquée)
- `d1211f0` Temps réel : chacun écoute son canal privé, plus la table messages entière
- `38270c5` Catalogue : l'accueil et la recherche lisent un cache au lieu de la base
- `afd7ae4` Photos : en cache un an au lieu d'une heure
- `769221c` Agent testeur : le site, la base et l'app ont un testeur qui n'oublie rien
- `e76c014` Agents : la base, la compatibilité de l'app et la production ont chacun leur gardien

### 2026-10-11

- `daf0eab` Mot de passe redemandé : vérifié par le serveur, plus seulement par l'écran

### 2026-10-09

- `aefd1da` Documents : état au 2026-10-09, domaine, emails et API de l'app
- `f1235e0` Mémoire : historique régénéré après la fusion de dev dans main
- `f852a43` Fusion de dev dans main : l'app mobile a son API en production

### 2026-10-07

- `2050b90` Mémoire : les emails partent bien du SMTP Gmail, plus du serveur d'essai
- `4892886` Mémoire : le code des emails est posé et fonctionne dans l'app
- `15bb1ad` App mobile : supprimer son compte sans passer par le site
- `182a2af` App mobile : sortie du dépôt, elle vit dans tirry224/filloo-mobile
- `2d5c2e2` App mobile : notifications du téléphone
- `c4eb28d` Notifications : téléphones de l'app, et plus d'email de notification
- `07d1440` Migration 0035 : les téléphones de l'app mobile (appliquée)
- `56ccdb3` Notifier le destinataire d'un message envoyé depuis l'app
- `e64aad2` App mobile : icônes, écran de démarrage et configuration de compilation
- `db74a74` App mobile : mot de passe oublié, mes informations, changer de mot de passe
- `fca5c39` App mobile : bloquer, débloquer et signaler
- `e27ae6e` App mobile : inscription commerçant et boutique
- `1f590cc` App mobile : messagerie côté commerçant
- `2c83a8a` App mobile : espace commerçant, mes produits et formulaire produit
- `6802873` App mobile : inscription, « Contacter le vendeur » et messagerie client
- `30bf0a8` App mobile : recherche et page boutique
- `c8c8189` App mobile : catalogue sans compte et fiche produit
- `a6ca44b` App mobile : squelette Expo dans mobile/, connexion à Supabase
- `aceecc7` Suivi : retrait du diagnostic temporaire
- `aa0c18a` Suivi : diagnostic temporaire du compte propriétaire
- `b836b87` Suivi : la règle du propriétaire tient aussi après la connexion
- `8bf1ea1` Suivi : le compte du porteur du projet ne voit que /suivi
- `a9231df` Git : dev pour travailler et tester, main seulement sur demande
- `157c1a7` Suivi : retrait du diagnostic temporaire
- `660f27d` Suivi : diagnostic temporaire du compte propriétaire
- `5e81ed9` Suivi : la règle du propriétaire tient aussi après la connexion
- `6e093ea` Suivi : le compte du porteur du projet ne voit que /suivi
- `2535655` Git : dev pour travailler et tester, main seulement sur demande
- `7960c95` WhatsApp : chaque clic est compté
- `5cf7fcb` Suivi : un écran qui montre ce qui se passe dans Filloo
- `04e0449` Placeholders : textes génériques au lieu d'exemples nominatifs

### 2026-10-02

- `5d092aa` MEMOIRE : service_role réglée, push toujours en panne au 2 octobre
- `3099723` Le README dit qu'une boutique est en ligne dès sa création
- `5646bea` Reapply "Les conditions disent qu'une boutique est en ligne dès sa création"
- `1c632c4` Reapply "Une boutique est en ligne dès sa création"
- `7e22be2` README et MEMOIRE disent où en est le projet au 2 octobre
- `fc971cb` La confirmation de l'email ramène au bon endroit, et se renvoie
- `635452e` Revert "Une boutique est en ligne dès sa création"
- `29bcd1a` Revert "Les conditions disent qu'une boutique est en ligne dès sa création"
- `3d744c6` Les conditions disent qu'une boutique est en ligne dès sa création
- `1c1d539` Une boutique est en ligne dès sa création

### 2026-09-28

- `cc97c9c` Le test de notification dit pourquoi il échoue
- `106bc0f` Le prix se groupe par milliers pendant la saisie
- `f83b85f` L'application rouvre sur l'espace quitté en dernier
- `b763e03` Débloquer une personne, et un blocage ferme le fil dans les deux sens
- `7be1feb` Pastille des messages non lus sur l'icône de l'application
- `a0dc56f` Son propre produit ne renvoie plus vers l'espace vendeur

### 2026-09-27

- `14e2ed0` Supprimer son compte efface aussi les lignes product_images
- `459e795` Supprimer son compte demande le mot de passe
- `b32d879` Supprimer son compte efface aussi les photos produit
- `b146b8b` Supprimer son compte efface aussi les coordonnées de la boutique
- `ef3fdff` Une suppression interrompue avant le bannissement peut être relancée
- `eeb53ca` CLAUDE.md : répondre avec le strict nécessaire
- `2fc3cc2` Un hook pre-commit régénère la mémoire à chaque commit
- `1bc77ea` La mémoire rattrape les dix derniers commits

### 2026-09-25

- `67e155c` La suppression efface aussi la copie de l'email dans les métadonnées
- `560d27c` Un email dont le compte a été supprimé peut resservir
- `a220d4a` Le champ téléphone n'accepte que neuf chiffres
- `3f673b6` Un seul bouton « Supprimer mon compte », à côté de « Se déconnecter »
- `f521ccf` Un mot de passe refusé pour sa composition dit pourquoi
- `43c345f` Le lien de réinitialisation marche quel que soit le navigateur qui l'ouvre
- `14bf1c6` L'iPhone ne zoome plus quand on touche un champ
- `1e671d9` Les photos de produits retombent aussi sur le JPEG hors WebP
- `5977f36` La photo de boutique s'envoie depuis un iPhone
- `856a66e` La mémoire note la photo de boutique dans la recherche et la messagerie
- `71f14f2` La photo de la boutique dans la recherche et la messagerie
- `7bec856` 0030 : search_products renvoie la photo de la boutique
- `c7a8864` La mémoire note la photo de boutique, à vérifier sur un téléphone
- `8d910da` Le commerçant choisit la photo de sa boutique, le client la voit
- `9491005` 0029 : une boutique a une photo de profil, dans son propre bucket
- `f035468` La mémoire dit ce que npm run e2e couvre, et ce qu'il a trouvé
- `c168c3e` Les parcours se jouent dans un vrai navigateur : npm run e2e
- `2ec4ddb` Le cron du matin efface aussi les photos orphelines
- `6b3c95c` 0028 : la base désigne les photos orphelines et purge les mesures
- `19949c0` L'Action Migrations passe à checkout et setup-node v5
- `99c06da` Une Action GitHub compare les migrations à chaque push et chaque matin
- `98c1b33` npm run migrations compare le dépôt à la production, dans les deux sens
- `960045d` La mémoire note 0026 restée un jour sans être appliquée
- `3cc22c2` Un seul signalement en attente par personne et par cible
- `704fde0` La mémoire dit ce que le test de chaos a corrigé, et ce qu'il laisse
- `79580d9` Les saisies absurdes sont refusées avant la base, en français
- `5a23b3b` Un identifiant absurde dans l'adresse mène à « introuvable », pas à un 500
- `0015a21` Plus aucune erreur technique en anglais sous les yeux de l'utilisateur
- `89c2b8c` Un envoi raté ne détruit plus la saisie, et ne part qu'une fois
- `5e94532` La suite de sécurité suit la limite de cinq photos
- `69dcf43` Ouvrir une conversation amène aux derniers messages
- `4742fe9` Le son d'un message relance le contexte audio au lieu de se taire
- `d6db7c7` L'en-tête des écrans reste en haut pendant le défilement
- `37de05a` Une suppression de compte refusée le dit au lieu de parler de wifi
- `1de4d64` Un fil ouvert éteint le badge de non-lus tout de suite
- `6a12be1` Le son d'un message reçu se déverrouille aussi sur iPhone

### 2026-09-24

- `4cd71bf` Un formulaire refusé garde ce qui a été tapé
- `1942531` Le prix d'un produit se lit comme l'écrit un commerçant
- `dc48399` Les notifications push changent de clé VAPID
- `994e06c` Le contact et l'envoi des emails passent par filloo.gn@gmail.com

### 2026-09-23

- `0d98bef` L'icône de l'app porte un F
- `cc4c180` Le projet s'appelle désormais Filloo
- `5ffecd2` Un produit peut porter cinq photos
- `4a3376b` La proposition d'installation survit à la navigation
- `9af0232` Les photos d'un produit se parcourent en glissant
- `02baaa7` La mémoire décrit les alertes de message
- `0c3ef98` Le push part à chaque message, avec vibration
- `d9c7c89` Un message reçu sonne et s'annonce sur tous les écrans
- `922550e` La mémoire garde les trois défauts trouvés par le parcours réel
- `eb6f842` Une boutique en attente voit la confirmation de son brouillon
- `895fb61` Modifier un produit publié ne le dépublie plus
- `4aeaded` Le temps réel s'abonne avec la session, plus en anonyme
- `7089de7` La mémoire note l'inscription cassée et le push jamais distribué
- `571f7fc` Un brouillon se publie depuis son formulaire
- `b3bd53b` Chaque conversation montre la photo de son produit
- `1f156ab` Le compteur de messages non lus suit l'arrivée des messages
- `f15362c` npm run largeurs ne vide plus le formulaire de connexion
- `9f6e4e5` Les commentaires du responsive reviennent au strict nécessaire
- `745bc25` Ajoute la vérification des largeurs d'écran
- `7b979ab` Le choix des photos ne sort plus d'un écran de 320 px
- `fe5e12b` Le responsive s'étend à toute l'application, et se centre
- `c4c488a` Les commentaires explicatifs disparaissent de 157 fichiers
- `6452d99` next-env.d.ts retrouve sa version d'avant le build
- `2809134` MEMOIRE remplace REPRISE, avec un historique généré depuis Git
- `9bc51bf` REPRISE : deux points fermés que le fichier tenait encore pour ouverts
- `be88c30` Les écrans en lignes ne s'étirent plus sur toute la largeur
- `188d5c0` L'application tient enfin sur un écran qui n'est pas un téléphone
- `7685a8a` Le lien de réinitialisation ne porte plus de paramètre inutile
- `c01e1dd` La consigne iPhone nomme le bouton Partager au lieu de le situer

### 2026-09-22

- `1f8e318` L'application propose de s'installer à l'entrée
- `8cac97c` Le bouton WhatsApp ne menait nulle part : il manquait l'indicatif
- `8335e15` L'exigence « marcher sans JavaScript » est retirée des règles
- `ae88b7b` « Autre » disparaît du catalogue
- `6600ce9` La politique de confidentialité nomme son responsable
- `6ec3610` REPRISE et README : ce qui a changé, et la preuve qui déclasse un blocage
- `3cdba39` Les premiers tests de la couche applicative, là où les bugs se trouvent
- `ddbebdd` Compter ce qui se passe, sans rien envoyer au téléphone
- `c417690` Les deux promesses des conditions ont enfin quelque chose derrière
- `1508e9e` Un lien Makiti partagé montre enfin ce qu'il désigne
- `70302ad` Supprimer un produit n'abandonne plus ses photos, et créer se réessaie
- `bc3b42f` L'écran de recherche vide annonçait un chiffre faux
- `13f4501` Une seule adresse de site, et l'intention qui survit au mot de passe oublié

### 2026-09-21

- `22f1ae2` REPRISE : un fichier qu'on relit, au lieu d'un journal qu'on empile
- `f066fdd` Commentaires : ne garder que le pourquoi non déductible du code

### 2026-09-20

- `4a0b33b` Onzième passage : six commentaires qui mentaient, corrigés
- `ffe0041` Dixième passage : les deux derniers fichiers des agents
- `70c0dae` Neuvième passage : les derniers écrans rendus par les agents
- `30e73c0` Huitième passage : 35 fichiers rendus par les agents
- `bb31198` Septième passage : premiers retours des agents relancés
- `8499d95` Sixième passage : trois écrans de plus
- `8610bad` Cinquième passage : les cinq fichiers de sécurité sont faits
- `3579ee8` Quatrième passage : 27 fichiers, dont les cinq de sécurité
- `6e3e0f9` Troisième passage : les gros blocs d'interface, et mes propres excès
- `10b73d9` Deuxième passage : les récits raccourcis, deux mensonges corrigés
- `0cd3594` Les commentaires disent la décision, plus le journal de bord
- `33c7960` Une seule police : 40,3 Ko de moins au premier chargement

### 2026-09-19

- `9012f57` Le nom et le téléphone appartiennent à la connexion, pas au rôle
- `dd2d055` Le second compte hérite de l'identité, il ne la redemande pas
- `8720fa6` Le journal dit ce qui a été fait, et ce que la lecture du code a trouvé
- `4a818db` Un réabonnement ne laisse plus un fantôme derrière lui
- `987ac96` Les appareils partent avec le compte supprimé
- `fea7273` Une décision d'administration arrive aussi sur l'écran verrouillé
- `9dd47fb` Les notifications se proposent, au lieu d'attendre qu'on les trouve
- `221517d` L'interrupteur des notifications ne peut plus rester muet
- `f7a7963` Les notifications push arrivent sur l'écran verrouillé (étapes 5 à 7)
- `cd2923b` `0023` est exécutée, et les types connaissent la table
- `61dd948` Les fondations des notifications push (étapes 1 à 4)
- `6fda931` Vérifier un mot de passe ne déconnecte plus la personne
- `1399909` Le mot de passe se demande au moment d'enregistrer, pas avant
- `fd7a929` Le mot de passe sort des « informations », et les informations se confirment
- `ce9f8d3` Les filtres tiennent sur une ligne, et leurs panneaux remontent du bas
- `53f2f49` Les catégories du fil d'accueil redéfilent au doigt
- `b3515e9` Toucher à côté referme le panneau, comme partout ailleurs
- `0f0131b` Les catégories du fil d'accueil tiennent dans un panneau
- `50cb61e` Filtrer sans quitter ses résultats
- `dc35e59` Trois leçons sauvées d'une branche avant qu'elle ne ferme
- `d7a01cd` Une coupure de réseau se dit, au lieu de passer pour une panne
- `7f3e647` Un numéro de téléphone est vérifié, et enregistré sous une seule forme
- `4ca3afe` Deux branches tranchées, et pourquoi la suppression n'a pas eu lieu ici
- `d3af7ea` Les documents rattrapent les deux écrans nés du rapatriement

### 2026-09-16

- `118096d` Enregistrer sa boutique demande le mot de passe actuel
- `abdad96` Un mot de passe qu'on crée se tape deux fois
- `61f0b24` Modifier sa boutique devient un geste qu'on demande
- `8893324` L'espace marchand passe à quatre onglets, comme le prototype
- `c4cf10a` Les trois feuilles du fil portent enfin la garde de leur voisin

### 2026-09-19

- `ef7183b` `main` devient la seule branche, parce que l'autre n'existait plus
- `64e9c63` Le cron passe à une fois par jour, et les déploiements repartent

### 2026-09-17

- `b92399a` Les conditions d'utilisation existent, et la ligne mène enfin quelque part
- `c4486d3` README et REPRISE remis à l'heure : le SMTP de production fonctionne
- `ba9d772` Le README ne sous-estime plus ses propres tests
- `a2e72f0` Une suspension gèle le fil dans les deux sens
- `e56434b` Les décisions d'administration savent enfin se dire

### 2026-09-16

- `3bd6a45` Où le travail doit vivre : la règle Git entre dans les instructions
- `2116be5` Deux espaces séparés par l'arborescence, plus par une prop
- `d01f6f2` Le README des tests compte juste, et dit comment en douter
- `f40c204` La case « valider » est enfin testée (0018 et 0019)
- `e497410` Les types régénérés disent enfin le schéma déployé
- `3941a65` Les écrans vendeur suivent enfin l'état réel de la boutique
- `7ad3fea` Notification email d'un nouveau message, par Resend
- `d8a74b8` REPRISE : le trou 0018/0019 est comblé, l'écart de commentaires est noté
- `8270adb` Reconstitue les migrations 0018 et 0019 depuis la production
- `d862cb8` REPRISE : le trou 0018/0019 est nommé, et 0020 est appliquée
- `33025cd` 0020 : la note de numérotation revient après la date de découverte
- `627eac7` « Vendu » ne contourne plus le contrôle de publication

### 2026-09-15

- `0fbeee3` La reprise décrit enfin la base réelle : 0016, 0017 et leurs pièges
- `0618e2c` Deux défauts trouvés par l'audit indépendant du scénario 1
- `f08508e` 0017 : la fonction de gel ne répond qu'aux participants
- `51f7bcd` Boutique suspendue : lecture seule, et le quota se dit au lieu de planter
- `b2049f8` Parcours « visiteur → produit → contacter » : quatre défauts fermés
- `2b4a2fb` 0015 est appliquée : la documentation le disait encore à faire
- `bd57a0f` Vérification post-correction : deux défauts fermés, 0015 testée clause par clause
- `3f5023c` Audit des parcours : séparation client/commerçant, suspensions, refus

### 2026-09-10

- `be724e3` Ignorer les réglages d'éditeur

### 2026-09-14

- `f8a8eb5` Temps réel : ne pas rafraîchir le fil pour ses propres messages
- `1655b1a` Recherche : l'écran de repos, les recherches récentes, le zéro chiffré
- `9871be5` Temps réel de la messagerie : le fil se rafraîchit à l'arrivée d'un message
- `2c616a3` 0013 — une boutique suspendue quitte la vitrine

### 2026-09-13

- `fb01c9c` Deux textes qui affirmaient ce que rien ne mesure
- `050e80f` Deux écrans qui mentaient sur ce que le produit permet
- `ce11f63` Trois états que l'écran ne distinguait pas
- `fea292b` WhatsApp était promis deux fois et offert nulle part
- `7e1424b` Quatre défauts du parcours client, dont deux bloquants
- `1893051` Deux règles qui valaient pour les deux rôles n'en servaient qu'un
- `e927c84` La porte manquait aussi dans l'autre sens
- `6971c9b` Ouvre la porte du compte vendeur, qui n'existait nulle part
- `2f3188f` Un message d'erreur qui accuse la bonne cause
- `f37038d` L'écran de suppression de compte demande enfin qui vous êtes
- `7615b8c` Inscrit la règle de compte rendu dans CLAUDE.md
- `9ef3a1b` Note ce qu'une session peut voir de l'application, et ce qu'elle ne peut pas
- `c4bb3b5` Une panne de réseau ne se fait plus passer pour une absence
- `3cc9a1d` Rectifie la leçon qui m'a fait corriger les mauvais endroits
- `aa18a3c` Les écritures qui pouvaient échouer en silence le disent maintenant
- `9c633cd` Un signalement refusé par le RLS ne dit plus « envoyé »
- `2b89420` Écran 32b : signaler une conversation avec un vrai motif
- `f41463f` Audite le fichier de reprise contre le code, et corrige un point
- `b9da316` Réécrit le fichier de reprise : ce qui reste d'abord

### 2026-09-12

- `e9b06c7` Remet REPRISE.md et le README en accord avec l'état réel
- `3db6ee2` Deux barres d'onglets, une par espace
- `dfe3a11` Les espaces client et commerçant ne se mélangent plus
- `d82019b` Approuver ou refuser une boutique en un seul geste
- `20b7f81` Supprime le jeu de démonstration et répare les liens morts de /ecrans
- `2110db5` Note l'application de 0011 sur le projet Supabase réel
- `1bc7f89` Corrige quatre bugs de la couche applicative

### 2026-09-11

- `63cc195` docs: précise la ville de résidence dans REPRISE.md (#4)
- `e14c52a` Ville de résidence du client dans « Mes informations » (#3)
- `dc6b05e` Branche « Mon compte » et la suppression de compte (étape 4 de REPRISE.md)
- `24dd80b` Branche la messagerie sur la vraie base (étape 3 de REPRISE.md)
- `0aef09b` Branche le tri et le choix de ville sur l'écran de recherche
- `fc320bd` Retire la barre de recherche de l'accueil, simplifie l'écran de recherche
- `d4d6c98` Corrige les appels réseau dupliqués sur l'espace vendeur
- `c99ccda` Branche l'espace vendeur sur la vraie base (étape 2 de REPRISE.md)
- `77ea8ce` Corrige la branche par défaut GitHub, nettoie les branches obsolètes
- `c8e5fbb` Remet docs/REPRISE.md en accord avec l'état réel du projet
- `2247511` Consolidation 3/3 : absorbe wizardly-cannon et brave-pascal en entier
- `3e9c8f6` Consolidation 2/3 : récupère l'outillage et les maquettes des trois autres branches
- `03bd313` Consolidation 1/3 : réunit prochaine-etape et main
- `1306131` Donne un tronc au dépôt et documente la règle
- `b045082` Verse les deux variables publiques dans un .env versionné
- `cf741e3` Ne fait plus échouer le build sur un « Invalid URL » muet
- `b80c51e` Rend l'échec de build compréhensible quand la configuration manque
- `01439a5` Branche le catalogue public sur la vraie base
- `68e65b1` Resynchronise le dépôt Git avec la base Supabase réellement déployée
- `247f34d` Branche l'authentification et l'inscription commerçant sur Supabase
- `8f75541` Étape 9 (3/3 du catalogue public) : recherche, fiche produit, boutique
- `73ad3c1` Étape 9 (2/3) : /  branché sur les vraies données
- `849b9af` Étape 9 (1/3) : projet Supabase réel créé et migrations déployées
- `3834bdf` Schéma des comptes liés : profiles.id ne partage plus auth.users.id
- `b201db8` Tranche les deux manques restants : blocage et suppression de compte
- `a5231fa` Motif de refus d'une boutique : schéma, sécurité, écran (Étape 8)
- `b4ec173` Filtre de catégorie réel, deux dead-ends corrigés, décision compression
- `a3ca268` Comptes liés client/commerçant, positionnement, corrections visuelles

### 2026-09-10

- `07b8440` Document de reprise
- `12bb220` Les 33 écrans de l'application
- `f2417f3` Écrans manquants et page introuvable
- `5935c72` Design system et bibliothèque de composants
- `f09fb26` Maquette complète : les 32 écrans de l'application

### 2026-09-09

- `834825c` Maquette mobile : onze écrans et deux directions visuelles
- `19c31db` Messagerie : un seul fil par client, contexte porté par le message
- `c63ad83` Fondations : spécification, schéma de base de données et sécurité

<!-- FIN HISTORIQUE -->
