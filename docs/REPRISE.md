# Reprendre le travail sur Makiti

Point d'entrée pour continuer le projet dans une nouvelle conversation.
Il dit **ce qui reste**, **ce qui est fait**, **ce qui est déjà tranché**
(pour ne pas le rediscuter) et **ce qui a déjà fait mal** (pour ne pas le
refaire).

Dernière mise à jour : **2026-09-19** (le cron ramené à une fois par
jour, parce que l'offre Vercel est passée en Hobby — voir le journal). Réécrit de zéro le 2026-09-13, parce
que le plan était devenu illisible : quatre cinquièmes du document
racontaient le passé, et « ce qui reste » vivait en section 3, après 330
lignes d'archéologie de branches. Un fichier de reprise qu'on ne lit plus
ne reprend rien.

**État en une phrase :** l'application est complète, branchée sur la
vraie base, en ligne, et ses emails partent enfin — ce qui la sépare
d'un vrai commerçant n'est plus du code mais trois choses à constater :
`CRON_SECRET`, un email réellement reçu, et le parcours fait une fois
sur un vrai téléphone.

---

## 1. Ce qui reste à faire

### Bloquant pour un lancement

**1. Les emails (Resend).** Ce point n'est plus bloquant : il ne reste
qu'une variable et une vérification.

- **Notification de nouveau message** — code fait, Resend branché sur
  Vercel. *Reste à CONSTATER un envoi réel* dans une vraie boîte.
- **Décisions d'administration** (validée, refusée, suspendu) — `0021`,
  `src/lib/notifications-decisions.ts`, `/api/notifications`,
  `vercel.json`. **Reste `CRON_SECRET` sur Vercel**, sans laquelle la
  route refuse tout. La fréquence, elle, est tranchée par l'offre : une
  fois par jour à 7 h UTC depuis le passage en Hobby, donc **jusqu'à 24 h
  entre une validation faite dans Supabase et l'email reçu**. À décider :
  vivre avec ce délai, ou sortir la planification de Vercel (voir le
  journal du 2026-09-19).
- **Emails d'authentification** — *FAIT le 2026-09-17* : le SMTP de
  Resend est branché dans Supabase et fonctionne. C'était le dernier
  vrai verrou : sans lui, le premier commerçant qui oubliait son mot de
  passe était enfermé dehors définitivement.
- **Confirmation d'inscription** — décidée (SPEC décision 1), le code la
  gère déjà (`needsConfirmation`), et elle est **activable maintenant**
  que le SMTP fonctionne. Pas avant : activée sans SMTP, elle bloque
  toute inscription.
- *Le compteur de non-lus est fait de bout en bout depuis le
  2026-09-15* : `read_at` (`0001`), RLS restreinte à cette colonne
  (`0002`), `countUnreadMessages` par espace, les deux barres d'onglets.

**2. Le texte des conditions d'utilisation** — *FAIT le 2026-09-17*. Le
porteur du projet a fourni le texte (25 articles) ; il vit dans
`src/content/conditions.ts`, séparé de l'écran qui l'affiche pour se
relire et se corriger sans traverser du JSX. Écran 34, monté par deux
routes : `/conditions` (publique) et `/vendeur/conditions`. Les deux
lignes de menu, qui affichaient « Bientôt » depuis le 2026-09-15, sont
redevenues de vrais liens.

*Ce qui reste autour, et qui n'est pas ce texte* : l'article 19 renvoie à
une **Politique de confidentialité** qui n'existe pas encore, et
l'article 24 à un **moyen de contact indiqué sur la plateforme** qui
n'est indiqué nulle part. Deux promesses écrites noir sur blanc dans un
texte qui engage la plateforme — c'est exactement le défaut que ce texte
venait réparer, déplacé d'un cran.

### Commencé le 2026-09-12, pas fini

**3. Parcourir tous les écrans dans un navigateur.**
*Avancé le 2026-09-13* : 10 écrans parcourus en 400 px depuis
l'environnement de travail (Chromium local contre `npm run dev`), deux
défauts trouvés et corrigés — voir le journal. **Mais cet environnement
ne joint ni `*.supabase.co` ni `*.vercel.app`** (403 de la politique
d'egress, images Docker bloquées aussi, donc pas de pile Supabase
locale) : je peux voir le rendu et le comportement base injoignable,
jamais un écran portant de vraies données. Les trois parcours ci-dessous
restent donc entièrement à toi.* Le premier vrai
passage sur téléphone a trouvé en quelques minutes quatre défauts que ni
le build, ni le typecheck, ni 61 tests de sécurité n'avaient signalés
(détail en section 5). Il reste à faire le tour, écran par écran :
`/ecrans` les liste en développement et allume chaque lien dès que
l'enregistrement correspondant existe. **Noter les défauts au fil de
l'eau plutôt que les corriger un par un** — ils se traitent mieux en lot.

Ce qui n'a **jamais** été vu à l'écran, et qui est donc prioritaire :

- la messagerie entre deux comptes réels ;
- l'envoi d'une photo depuis un téléphone ;
- le parcours de refus d'une boutique.

**4. Finir les formulaires qui marchent sans JavaScript.** À moitié
fait : les champs texte et les actions produit fonctionnent sans script,
`PhotoPicker` et le `Toggle` « prix négociable » non. Sur un réseau
guinéen instable, un formulaire qui exige que le script soit chargé est
un formulaire qui échoue.

### Décisions à prendre — ce n'est pas du code

**8. Le parcours vers le compte lié.** Pas un bug, une observation de
terrain : le porteur du projet lui-même, en testant, a créé DEUX
CONNEXIONS distinctes au lieu d'un second profil lié sur la même
connexion. L'écran d'inscription ne propose le compte lié qu'à une
personne DÉJÀ connectée — ce qui n'est pas le réflexe de quelqu'un qui
veut « aussi vendre ». Si le porteur du projet se trompe, l'utilisateur
se trompera.

**Les libellés des 10 catégories et la liste des villes.** Le NOMBRE est
tranché (10, décision 3 de SPEC), les mots ne le sont pas — et ils se
voient sur le premier écran de l'application.

### Tranchées le 2026-09-17 — ne pas les rediscuter

Elles sont écrites dans `docs/SPEC.md`, qui fait foi ; elles sont
rappelées ici seulement pour que la session suivante ne les rouvre pas.

**5. Le critère de validation d'une boutique : un APPEL.** Le porteur du
projet téléphone au commerçant et confirme de vive voix. Ça ne passe pas
à l'échelle, et c'est voulu tant qu'on vise la densité avant le volume.

**6. Confirmation d'email : OUI.** Et la crainte notée ici était
exagérée : le code la gère DÉJÀ de bout en bout — `signUpAction` renvoie
`needsConfirmation` quand Supabase ne rend pas de session, et
`SignupForm` affiche « Vérifiez votre email… ». Ce n'est donc pas un
écran à dessiner mais une case à cocher côté Supabase. **Dans cet ordre,
et pas l'inverse : le SMTP de production D'ABORD.** Activée avant,
la confirmation rend l'inscription impossible pour tout le monde,
puisque personne ne recevra jamais le lien.

**7. Dix catégories.** La base en porte déjà 10 : la décision ne coûte
aucune migration, seulement les libellés à arrêter (voir ci-dessus).

**15. Écrire à un client suspendu : INTERDIT, comme dans l'autre sens.**
`0022` ajoute la condition manquante à `conversation_is_open` — les deux
côtés du fil doivent être actifs. Les fils restent LISIBLES. Le texte du
fil gelé a dû devenir triple : un commerçant en règle dont le client
venait d'être suspendu lisait « votre compte ne permet plus d'écrire »,
c'est-à-dire une accusation fausse sur un écran où il n'a personne à qui
répondre.

**L'email de refus d'une boutique : OUI.** Il est parti avec `0021`. La
question que j'avais posée — un refus par email appelle une réponse, et
il n'y a pas de canal pour la recevoir — est tranchée en l'assumant :
l'email invite explicitement à répondre, donc la boîte de `EMAIL_FROM`
doit être relevée par un humain.

### Non bloquant

**9. Temps réel de la messagerie.** *À moitié fait, et la moitié faite
n'était plus écrite ici* : `RealtimeThread` est monté par `ThreadScreen`
sur la migration `0014`, donc un message reçu PENDANT qu'on lit le fil
s'affiche. Ce qui ne bouge toujours pas en direct : la liste
`/messages` et le badge de la barre d'onglets, qui attendent une
navigation. Assumé comme non bloquant : une marketplace de mise en
relation n'est pas une messagerie instantanée.

**10. Recherche v2** — quatre états d'écran, filtres, recherches
récentes. Écrite sur `kind-thompson` contre un backend fictif : elle se
réimplémente sur la vraie couche de données, elle ne se fusionne pas.

**11. Bandeau de réseau dégradé** (`BandeauReseau` sur `kind-thompson`,
même remarque).

**12. Supprimer `/ecrans` et `/styleguide`** une fois le point 3
terminé. Elles sont déjà introuvables en production, mais une page de
travail qu'on oublie de retirer finit par être trouvée.

**13. Regarder le projet Supabase « Fillo »** du 2026-08-25, qui tourne
encore à côté de `Makiti` sans qu'on sache s'il sert.

**14. Nettoyer deux branches.** Vérifié le 2026-09-13 :
`claude/fillo-project-review-0ky4ei` est au même commit que `main`, et
`claude/profile-city-edit-5cxvjb` ne porte qu'un commit de documentation
déjà repris sur `main`. Les deux sont supprimables sans perte.
**`claude/kind-thompson-khl111` doit être gardée** : 10 commits absents
de `main` (voir points 10 et 11).

### Dettes techniques connues, aucune bloquante

- **Aucun test automatisé côté front.** 114 tests couvrent le SQL, zéro
  couvre la couche applicative — là où se trouvaient les quatre bugs du
  2026-09-12. C'est le déséquilibre de fond du projet : la couche la
  mieux testée n'est pas celle qui casse. **Démontré une fois de plus le
  2026-09-15** : le contournement de `safeNextPath` par une tabulation
  vivait précisément là, et les quinze cas qui l'ont trouvé ont été
  exécutés depuis `/tmp` — ils ne sont pas dans le dépôt. Le même défaut
  peut donc revenir sans que rien ne le dise. Node 22 sait exécuter
  `node --test` sans installer quoi que ce soit : il n'y a même plus
  l'excuse de la dépendance.
- **`?next=` se perd sur deux chemins.** `signUpAction` ne passe pas
  d'`emailRedirectTo`, donc si la confirmation par email est réactivée
  (décision 6), le lien reçu ramène à la racine du site et le produit est
  perdu. Le lien « Mot de passe oublié ? » de l'écran de connexion ne
  transporte pas `next` non plus. Latent aujourd'hui : la confirmation
  est désactivée, vérifié en base le 2026-09-15 (`confirmation_sent_at`
  nul sur tous les comptes).
- **Le dépôt et la production ne portent pas les mêmes commentaires
  SQL.** Mesuré le 2026-09-16 sur `approve_merchant` (`0012`) :
  l'empreinte `md5(pg_get_functiondef())` diffère entre un PostgreSQL
  reconstruit et la production, et la SEULE différence est un
  commentaire absent en base. Déjà constaté sur `0015` le 2026-09-15 :
  c'est le mécanisme d'application qui retire les commentaires, pas une
  divergence de logique — aucun effet sur le comportement. Ce qui se
  perd est le raisonnement, et le dépôt en reste alors la seule copie
  lisible. **À traiter en corrigeant le mécanisme une seule fois, jamais
  en réécrivant une migration déjà appliquée** (règle de la section 4) :
  poursuivre chaque écart de commentaire par une migration de plus
  coûterait plus cher que le problème. Conséquence pratique à connaître
  avant de s'en servir : une comparaison d'empreintes entre local et
  production produit des faux positifs sur toute fonction commentée, et
  ne prouve donc rien seule.
- **Un test de quota accepte n'importe quelle erreur.** Dans
  `security_test.sql`, la boucle des 100 messages par jour affiche `OK`
  dans un `exception when others` sans vérifier le `sqlstate` : un refus
  RLS ou une faute de frappe dans le jeu de données produiraient le même
  vert. Le test du quota de conversations, lui, exige `P0001` — les deux
  devraient se ressembler.
- **Polices : 60 Ko pour un budget de 40** (`npm run poids`). Deux
  familles Google, toutes deux préchargées ; `preload: false` sur celle
  des titres suffirait peut-être. À mesurer, pas à supposer.
- **`middleware` est déprécié en Next 16** :
  `npx @next/codemod@canary middleware-to-proxy .`. Le faire débloquerait
  aussi un vrai 404 sur `/ecrans` (aujourd'hui un 200 qui porte la page
  « n'existe pas »).
- **`postcss` n'est pas déclaré dans `package.json`** alors que
  `scripts/verifier-classes.mjs` l'importe : ça marche par dépendance
  transitive de `@tailwindcss/postcss`, donc par accident.
- **L'en-tête `Host` n'est pas validé** dans
  `requestPasswordResetAction`. Non exploitable — Supabase filtre
  `redirectTo` — mais la protection vit dans un réglage de tableau de
  bord plutôt que dans le dépôt ; un `NEXT_PUBLIC_SITE_URL` la ramènerait
  sous contrôle de version.
- ~~**`/recherche` a son propre défaut « Conakry » en dur**~~ — réglé le
  2026-09-15. La ville de départ est résolue au même endroit pour les deux
  écrans (`getDefaultCityName`), et `activeFilterCount` compare désormais à
  CETTE ville : pour un client de Boké, sa propre ville n'est pas un filtre
  qu'il a posé. Le filtre reste manuel — `?ville=` gagne toujours.
- **`/inscription/boutique` hérite du squelette de chargement client** et
  affiche donc brièvement « Conakry » pendant l'inscription commerçant.

---

## 2. Ce que Makiti est

Une marketplace de **mise en relation** en Guinée. Les commerçants
publient leurs produits avec un prix, les clients les parcourent et
écrivent au vendeur par une messagerie interne. **Aucun paiement, aucun
panier, aucune livraison** : la vente se conclut hors de l'application,
en main propre.

Conséquence à garder en tête en permanence : le système ne sait jamais
qu'une vente a eu lieu. C'est pour cette raison qu'il n'y a **pas de
notation** — aucun avis ne serait vérifiable, donc tous seraient truqués.

Marché : Guinée · Devise : franc guinéen (GNF), en entiers · Langue :
français.

---

## 3. Ce qui est fait

### Spécification
`docs/SPEC.md` — 18 décisions tranchées et figées.
`docs/ECRANS.md` — inventaire des 33 écrans.
`docs/ARCHITECTURE.md` — organisation du code.
`docs/PERFORMANCE.md` — budgets de poids et méthode de mesure.

### Base de données — écrite, testée, ET DÉPLOYÉE

Projet Supabase `Makiti` (région eu-west-3), créé et migré le
2026-09-11. `supabase/migrations/` — 20 fichiers SQL, à exécuter dans
l'ordre sur un projet neuf, numérotés `0001`…`0020`, sans trou.

**Le trou `0018`/`0019` est comblé depuis le 2026-09-16.** Les deux
migrations avaient été appliquées au tableau de bord sans que leur
fichier soit commité ; leur SQL a été relu dans
`supabase_migrations.schema_migrations` et recopié tel quel, sans une
ligne de plus (commit `8270adb`). Git reconstruit donc à nouveau le
projet réel — une base neuve montée depuis ce dépôt porte la colonne
`valider`. `0020` avait pris le numéro suivant plutôt que de leur voler
le leur : c'est ce qui rend la suite rejouable telle quelle aujourd'hui,
et c'est la raison de garder cette habitude.

**Les 20 fichiers du dépôt sont appliqués au projet Supabase**, vérifié
dans `supabase_migrations.schema_migrations` — les 17 premiers le
2026-09-15, `0018`, `0019` et `0020` le 2026-09-16 :

- `0001_schema.sql` — 9 tables : profiles, merchants, cities,
  categories, products, product_images, conversations, messages,
  reports. Porte aussi la décision des **comptes liés** :
  `profiles.id` n'est plus la clé de `auth.users`.
- `0002_rules_and_security.sql` — **le fichier le plus important** :
  triggers métier et règles de sécurité au niveau des lignes (RLS).
- `0003_search_and_seed.sql` — fonction `search_products`, 10
  catégories, 12 villes.
- `0004_storage.sql` — stockage des photos.
- `0005` à `0010` — corrections postérieures : advisors Supabase,
  performance, produits vendus visibles, date de suspension, ville de
  résidence du client.
- `0011_active_product_keeps_an_image.sql` — un produit publié ne peut
  plus perdre toutes ses photos.
- `0012_approve_a_merchant_in_one_gesture.sql` — changer la seule
  cellule `merchants.status` suffit à valider ou refuser une boutique :
  la date se pose seule, un refus sans motif est refusé, un motif
  périmé s'efface.
- `0013_a_suspended_merchant_leaves_the_catalogue.sql` — la suspension
  vit sur `profiles.is_suspended`, la visibilité sur `merchants.status`,
  et RIEN ne reliait les deux : un commerçant suspendu gardait boutique,
  produits et bouton « Contacter ». On pouvait donc lui écrire sans
  qu'il puisse jamais répondre.
- `0014_realtime_on_messages.sql` — le fil se rafraîchit à l'arrivée d'un
  message.
- `0015_a_rejected_shop_can_be_resubmitted.sql` — une boutique refusée
  peut repartir en vérification après correction. UNE transition
  ('rejected' → 'pending'), sur sa propre boutique, jamais vers
  'approved' : le commerçant n'a toujours aucun droit d'écriture sur
  `merchants.status`.
- `0016_a_conversation_survives_a_suspension.sql` — deux défauts d'un
  seul tenant. **Suspendre un vendeur ne doit pas effacer ce que ses
  clients ont vécu** : `0013` retirait la ligne `merchants` à tout le
  monde, donc `getThreadContext` perdait sa jointure et le fil du client
  devenait une page introuvable, avec une ligne sans nom dans
  `/messages`. `i_talk_with_merchant` rend la boutique lisible à qui a
  déjà un fil avec elle — la branche symétrique de « profiles: je vois
  mes interlocuteurs », qui existait déjà dans l'autre sens. **Et
  personne ne contacte sa propre boutique** : le fil avait le même être
  humain des deux côtés, et surtout `bump_contact_count` faisait monter
  le produit dans le tri « populaires ».
- `0017_a_suspended_shop_freezes_its_threads.sql` — une boutique
  suspendue met ses fils en **lecture seule** : l'historique reste
  entier et lisible, plus personne n'y écrit. `conversation_is_open(cid)`
  garde la policy d'envoi. Elle ne regarde QUE l'état du compte en face,
  jamais `merchants.status` — une boutique renvoyée à la vérification
  (`0015`) n'a rien fait de mal et ses clients attendent une réponse.
  Elle exige en plus que l'appelant soit participant du fil : voir le
  piège correspondant en section 5.
- `0018_approve_a_shop_with_one_click.sql` — une case à cocher
  `merchants.valider`, pour valider une boutique d'un seul clic dans
  l'éditeur de table : `status` est un énuméré, le changer demande
  d'ouvrir une liste et de choisir. Seul le GESTE change — la vérité
  reste dans `status`, et la colonne reste hors de la liste blanche
  d'écriture, parce qu'un bouton « valider » accordé à un commerçant
  est exactement l'auto-validation trouvée par les tout premiers tests.
- `0019_the_validation_switch_shows_its_state.sql` — la case de `0018`
  se décochait toujours, donc une boutique déjà validée l'affichait
  vide : un bouton qui ment sur l'état qu'il commande.
  `sync_merchant_approval` remplace les deux triggers précédents et fait
  de `valider` un MIROIR de `status` — cocher valide, décocher remet en
  attente. Un refus ne passe pas par là : il s'écrit sur `status` avec
  son motif, que `0012` exige.
- `0020_sold_is_a_publication_too.sql` — **`sold` est un état
  publiquement visible que rien ne gardait**. La policy « products:
  catalogue public » publie `status in ('active', 'sold')` depuis
  `0008`, mais `check_product_publishable` ne vérifiait que `'active'` :
  un commerçant pouvait faire passer un brouillon sans photo directement
  à `'sold'` par un PATCH PostgREST, et le poser au catalogue sans
  jamais satisfaire une condition de publication. Le contrôle garde
  désormais l'**entrée** dans l'ensemble visible (`draft`/`hidden` →
  `active`/`sold`, et toute création directe dans ces statuts) ; les
  mouvements internes (`active` ↔ `sold`) et les sorties restent libres,
  pour ne pas casser « Marquer vendu » sur un produit publié dont la
  boutique a été refusée depuis.

Chaque migration est écrite pour être lue : le raisonnement complet est
dans le fichier, pas ici.

**Les 20 fichiers rejouent depuis une base vierge** — vérifié le
2026-09-16, `0018` et `0019` comprises, pas supposé
(`supabase/tests/README.md` donne la commande). C'est la seule
propriété qui compte pour une suite de migrations, et celle qui casse le
plus discrètement.

`supabase/tests/` — **114 vérifications de sécurité**, rejouables sur un
PostgreSQL local. Elles vérifient que les actions **interdites**
échouent, et ont déjà trouvé **trois vraies failles** (section 5). La
quatrième, la fuite de `conversation_is_open`, a été trouvée par une
vérification ciblée AVANT application, puis figée par deux tests de plus :
le filet n'attrape que ce qu'on lui a appris à attraper.

### Les quatre trous de schéma, tous comblés

Découverts en dessinant les écrans, tranchés le 2026-09-11 à la demande
du porteur du projet, vérifiés par les tests 17 à 19 de
`security_test.sql`.

1. **Le blocage entre personnes** → `conversations.blocked_by`
   (nullable, référence `profiles`). Porté par la conversation plutôt
   que par une table séparée : avec un seul fil par couple (client,
   boutique), c'est déjà le seul endroit où bloquer aurait un sens. La
   personne visée perd le droit d'écrire dans CE fil (RLS) ; le fil
   reste lisible pour les deux. Pas de déblocage en v1 : aucun écran ne
   le propose.
2. **Le motif de refus d'une boutique** → `merchants.rejection_reason`,
   écriture réservée à l'administrateur. Un refus sans explication est
   un vendeur perdu définitivement. Fermé complètement le 2026-09-12
   par `0012` : une contrainte CHECK refuse `status = 'rejected'` avec
   un motif vide. Posée en CHECK et non en trigger — une CHECK est
   vérifiée APRÈS les triggers `before`, donc rien ne peut la
   contourner en inventant un motif par défaut.
3. **La suppression de compte → anonymisation, jamais un vrai DELETE.**
   Les `on delete cascade` auraient effacé les messages envoyés dans
   TOUTES les conversations de la personne, y compris ceux que lit
   encore l'autre partie : c'est ça qui tranche, pas une préférence.
   `profiles.is_deleted` + `deleted_at`, colonnes admin-only. Raison
   précise : « supprimer mon compte » doit AUSSI couper l'accès à
   `auth.users`, que le RLS ne gère jamais — les deux doivent arriver
   ensemble, avec `service_role`, sinon un profil peut se retrouver
   marqué supprimé avec la connexion encore active.
   Réalisé comme une action serveur Next.js
   (`src/lib/actions/account.ts`, client `service_role` dans
   `src/lib/supabase/admin.ts`) plutôt qu'une Edge Function : même
   isolation, un aller-retour réseau de moins, un seul système à
   déployer. Et un **bannissement** plutôt qu'un `deleteUser` :
   `messages.sender_id` référence `profiles` SANS cascade, donc
   supprimer la ligne `auth.users` aurait échoué sur une contrainte au
   moment précis du clic. Les produits passent à `hidden` et
   `merchants.status` ne bouge pas — aucune valeur de l'énumération ne
   veut dire « fermée par son propriétaire », et masquer les produits
   vide déjà le catalogue public.
4. **Le lien entre les deux comptes d'une même personne** →
   `profiles.auth_user_id` fait le lien, `unique (auth_user_id, role)`
   limite à un profil par rôle et par connexion. Retenu plutôt qu'une
   table de liaison, qui n'aurait eu de sens qu'avec deux connexions
   distinctes — contraire à « une seule connexion, bascule sans
   reconnexion », déjà décidé.
   Conséquence dans TOUT `0002` : `auth.uid()` identifie désormais une
   CONNEXION, plus un profil précis. Chaque policy qui comparait
   directement une colonne à `auth.uid()` passe par une fonction
   (`my_profile_id(role)`, `owns_profile(id)`, `is_active_profile(id)`)
   qui résout « lequel de MES profils ». Testé de bout en bout sur un
   PostgreSQL recréé de zéro, pas déduit par lecture du code.

### Front-end

Next.js 16, React 19, TypeScript, Tailwind 4. **31 routes, 39
composants.**

- `src/styles/` — tokens (couleurs, typographie, rayons, **vocabulaire
  d'espacements nommés**) et un README expliquant comment modifier
  l'apparence. `npm run classes` détecte les classes Tailwind
  inexistantes, le défaut le plus silencieux du projet (section 5).
- `src/components/` — `ui/` sans métier, `product/`, `chat/`, `auth/`.
- `src/lib/supabase/` — **un client par requête** : `server.ts`
  (composants serveur), `client.ts` (navigateur), `middleware.ts`
  (rafraîchit la session à chaque requête). Un seul client global serait
  une faille : deux visiteurs partageraient la même session.
- `src/lib/data/` — lecture : `products.ts`, `merchants.ts`,
  `reference.ts`, `session.ts`, `messages.ts`. Seul endroit qui connaît
  la forme de la base ; traduit vers les types de `src/lib/types.ts`.
- `src/lib/actions/` — écriture : `auth.ts`, `merchants.ts`,
  `products.ts`, `messages.ts`, `account.ts`.
- `src/lib/mock.ts` — **ne sert plus que `/styleguide`** et la liste
  fixe des motifs de signalement. Plus aucun écran de l'application ne
  lit de fausses données.

**Authentification : faite.** Inscription client et commerçant,
connexion, déconnexion, mot de passe oublié, réinitialisation, comptes
liés.

**Toute l'application est branchée sur la vraie base**, en lecture ET en
écriture : catalogue public, espace vendeur, messagerie, compte,
suppression de compte.

**Compression des photos dans le navigateur** (`PhotoPicker`), faite le
2026-09-11 contre la vraie base.

Deux adresses de travail : **`/ecrans`** liste les écrans avec un lien
vers chacun ; **`/styleguide`** affiche tous les composants et tous les
tokens. Les deux sont à supprimer avant l'ouverture (point 12).

**Base vide, et c'est l'état voulu.** Le jeu de démonstration a été
supprimé le 2026-09-12 à la demande du porteur du projet, pour tester
avec de vraies données. `supabase/seed_demo.sql` reste dans le dépôt
pour pouvoir le rejouer — ses lignes de photos ne désignent aucun
fichier réel (vignettes cassées jusqu'à ce qu'un vrai commerçant en
dépose).

### Maquette
Publiée : https://claude.ai/code/artifact/5640888b-3a8e-4f07-aa50-4da03a76aef2
Sources dans `design/` (direction visuelle « A — Marché »). Republiée à
l'état réel le 2026-09-12 : 36 écrans, dont 5 corrigés (la maquette
promettait des choses que l'application ne fait pas) et 3 ajoutés
(l'application les fait, la maquette ne les montrait pas).

### Déploiement
Vercel, sur une adresse de la forme `<hash>-tiirry.vercel.app` (l'URL
exacte est dans le tableau de bord ; la connexion de travail ne voit pas
les projets personnels). **`main` est la branche de production : ce
qu'on y pousse part en ligne.**

### Commandes

```bash
npm install && npm run dev     # nécessite .env.local — voir README
npm run typecheck && npm run build
npm run classes                # classes Tailwind fantômes
npm run poids                  # budgets de poids (docs/PERFORMANCE.md)
npm run parcours               # mesure d'un parcours
```

---

## 4. Décisions prises — ne pas les rediscuter

- Catalogue **ouvert sans compte** ; compte exigé uniquement pour
  écrire.
- **Un seul fil par couple (client, boutique)** ; chaque message peut
  citer un produit, et le premier message d'un fil en cite
  obligatoirement un.
- **Une personne peut avoir deux comptes liés** (client et commerçant)
  derrière **une seule connexion**. Bascule rapide sans se reconnecter.
  **Jamais les deux mélangés sur un même écran** : à tout instant, un
  seul contexte est actif — barre d'onglets, écran d'ouverture et
  « Mon compte » compris.
- **Validation manuelle des boutiques**, depuis le tableau de bord
  Supabase. Aucune page d'administration en v1.
- **Publication immédiate des produits**, avec bouton « signaler » et
  masquage possible par l'administrateur.
- **Disponibilité binaire** : disponible ou vendu. Pas de gestion de
  stock.
- **Filtre de ville manuel**, jamais automatique.
- **La suspension coupe l'écriture, jamais la lecture.** Une boutique
  suspendue quitte la vitrine et ses fils passent en lecture seule des
  deux côtés ; l'historique reste entier et consultable. Décision du
  2026-09-15, appliquée par `0017`. Un refus de validation, lui, n'est
  pas une suspension : il retire du catalogue sans geler les fils.
- **On ne contacte pas sa propre boutique.** « Un client contacte un
  commerçant » veut dire quelqu'un d'autre — sans quoi le compteur de
  contacts, qui sert au tri « populaires », se remplit tout seul.
- **L'intention survit à l'authentification.** Le seul écran qui exige
  un compte est « Contacter le vendeur » ; qui s'y inscrit ou s'y
  connecte revient sur CE produit, jamais sur le fil d'accueil. Le
  paramètre `?next=` porte cette intention, et `safeNextPath` est le
  seul endroit qui décide s'il est sûr.
- **Pas de notation** tant que la transaction reste hors du système.
- **Aucune monétisation** en v1 (choix assumé).
- Direction visuelle **« A — Marché »** : fond papier chaud, accent
  terre cuite, bordures plutôt qu'ombres.

### Règles de travail

- **`main` est le tronc.** C'est elle que Vercel déploie, et c'est
  d'elle que part toute nouvelle branche. Née d'une panne réelle le
  2026-09-11 : le dépôt n'avait aucun tronc, six branches `claude/*`
  issues de sessions successives, et le réglage « branche par défaut »
  de GitHub pointait sur un arrêt sur image vieux de plusieurs jours. La
  production servait une version périmée pendant que les
  prévisualisations échouaient. Un dépôt sans tronc ne se contente pas
  d'être désordonné : il rend impossible la question « quelle version
  est en ligne ? ».
- **Une migration ne se réécrit jamais après avoir été appliquée** :
  elle décrit un pas déjà franchi, pas l'état final.
- **Toute migration appliquée au tableau de bord Supabase est commitée
  dans la même session**, et toute migration commitée est appliquée dans
  la même session. Les deux sens produisent le même écart : un dépôt qui
  décrit une base qui n'existe pas (ou plus).
- **Relancer les 74 tests après TOUTE modification de policy.** C'est
  ainsi que trois failles ont été trouvées, et aucune ne produisait
  d'erreur.

---

## 5. Pièges rencontrés — à ne pas refaire

C'est la section la plus utile du fichier. Chaque ligne a coûté du
temps.

### Sur la sécurité et le SQL

- **Révoquer un privilège sur une colonne ne sert à rien** si le
  privilège `UPDATE` existe au niveau de la table — ce que Supabase
  accorde par défaut. Il faut révoquer la table entière puis ré-accorder
  colonne par colonne. C'est ce qui permettait à un commerçant de
  s'auto-valider.
- **Le RLS filtre des lignes, jamais des colonnes.** Les deux questions
  se posent séparément à chaque table. C'est ce qui permettait à un
  participant de réécrire le message de son interlocuteur.
- **Le RLS ne se teste pas avec un outil qui le contourne.** La policy
  du catalogue public masquait les produits vendus, défaut invisible
  tant qu'il était testé via un accès administrateur. Trouvé en
  rejouant les requêtes en `set role anon`, comme un vrai visiteur.
- **Un avertissement de sécurité se vérifie, il ne se croit pas — dans
  les deux sens.** L'audit Supabase a signalé onze fonctions
  `security definer` « appelables en RPC par un inconnu ». Sept étaient
  de faux positifs (des fonctions de trigger, que PostgreSQL refuse
  structurellement d'exécuter autrement). Mais une était une vraie
  fuite : `is_active_profile(pid)` révélait si un profil ARBITRAIRE
  était suspendu ou supprimé. Ni « tout corriger » ni « tout ignorer »
  n'aurait donné le bon résultat.
- **Un identifiant difficile à deviner n'est pas une protection.** La
  première version de `conversation_is_open` (`0017`) ne regardait que
  l'état de la boutique, en tenant pour acquis qu'un identifiant de
  conversation n'est connu que de ses deux participants. Mesuré avant
  application : un troisième compte, à qui le RLS refuse la
  conversation, ses messages et jusqu'à la fiche boutique, obtenait
  quand même sa réponse en appelant la fonction avec cet identifiant.
  `security definer` rouvrait par la petite porte ce que trois policies
  fermaient par la grande. Un identifiant circule dans les URL, les
  journaux, les liens partagés et les captures d'écran : c'est une
  probabilité, pas une barrière. **Toute fonction `security definer`
  doit vérifier QUI demande, pas seulement CE QU'on lui demande** — la
  leçon avait déjà été tirée sur `is_active_profile` (`0005`), elle n'a
  pas été appliquée du premier coup à la suivante.
- **Un confort administratif est le moment exact où l'on rouvre une
  faille.** En simplifiant la validation d'une boutique (`0012`),
  mettre les fonctions en `security definer` les aurait rendues
  appelables en RPC par n'importe quel visiteur — c'est-à-dire
  l'auto-validation d'un commerçant, la toute première faille trouvée
  par les tests. `security invoker` est écrit en clair dans le fichier
  pour que ce soit un choix visible, pas un défaut subi.
- **Quand un modèle de données change, les protections écrites pour
  l'ancien deviennent souvent décoratives** sans qu'aucun test ne le
  signale. Arrivé au quota anti-spam lors du passage à un fil unique par
  client, puis au fichier de test lui-même lors du passage aux comptes
  liés : `security_test.sql` utilisait encore l'UUID de connexion comme
  s'il était l'identifiant du profil, et ne tournait plus du tout.
- **Une règle métier posée sur la table A ne voit pas les écritures sur
  la table B.** `products_check_publishable` interdit de publier un
  produit sans photo, mais il était posé sur `products` : rien ne se
  déclenchait quand les photos partaient par `product_images`, et c'est
  exactement le chemin que le code emprunte. Une protection se vérifie
  sur le chemin réel du code, pas sur celui qu'on avait en tête en
  l'écrivant.
- **Une migration appliquée au tableau de bord n'existe nulle part tant
  qu'elle n'est pas commitée.** Cinq migrations et une décision
  d'architecture entière ont vécu uniquement dans
  `supabase_migrations.schema_migrations`, invisibles depuis Git,
  pendant que la documentation continuait de décrire l'ancien modèle
  comme la vérité « figée ».

### Sur la couche applicative

- **Une liste blanche qui compare des préfixes valide une ORTHOGRAPHE,
  pas une adresse.** `safeNextPath` refusait `//autre.gn` et
  `/\autre.gn` en testant le début de la chaîne. Mesuré le
  2026-09-15 : une tabulation glissée en deuxième position
  (`/<TAB>/faux-makiti.gn`) passait le filtre, et Node émet l'en-tête
  `Location` avec la tabulation intacte — or la spécification URL impose
  aux navigateurs d'effacer tabulations, retours chariot et sauts de
  ligne AVANT d'analyser l'adresse, qui redevient alors `//faux-makiti.gn`.
  La redirection ouverte que le filtre existait pour fermer restait donc
  ouverte. **Une adresse se valide en l'analysant comme le fera celui
  qui la suivra** : caractères de contrôle refusés, puis résolution
  contre une origine qui n'existe pas, et l'origine doit être inchangée.
- **Une règle posée dans la base doit être DEMANDÉE à la base, et
  jamais sans session.** `getThreadContext` interroge
  `conversation_is_open` pour savoir s'il faut afficher le champ de
  saisie — bonne idée, une seule règle pour l'écran et pour la policy.
  Mais `execute` est révoquée à `anon` : pour un visiteur, la réponse
  était un refus, propagé jusqu'à la frontière d'erreur. Un lien de
  conversation partagé sur WhatsApp, ouvert sans session, affichait donc
  « Vérifiez votre connexion » — une panne réseau imaginaire — là où il
  rendait auparavant la page introuvable. Aucune page de `/messages`
  n'exige de session en amont : le middleware ne fait que rafraîchir le
  cookie.
- **« Pas d'erreur » ne veut jamais dire « c'est fait » — mais pas pour
  toutes les écritures.** Quand le RLS écarte une ligne, PostgREST ne
  renvoie pas d'erreur : il renvoie un SUCCÈS portant zéro ligne. La
  seule façon de savoir ce qui a changé est un `.select("id")` sur
  l'écriture.
  **Précision mesurée le 2026-09-13, après s'être trompé dessus** : cela
  vaut pour les `update` et les `delete`, dont le `using` filtre des
  LIGNES. Un `insert` refusé, lui, n'est PAS silencieux — un `with
  check` qui échoue lève « new row violates row-level security policy »,
  donc `error` suffit. Vérifié sur un PostgreSQL local, dans les deux
  sens, parce que la version imprécise de cette leçon a fait « corriger »
  deux `insert` qui allaient bien pendant que cinq `update`/`delete`
  restaient exposés.
  Le seul `insert` réellement silencieux est celui qu'un trigger `before
  insert` annule en renvoyant NULL (vérifié aussi) : aucun trigger du
  projet ne le fait aujourd'hui.
  **Une leçon formulée trop largement coûte autant qu'une leçon fausse :
  elle fait corriger les mauvais endroits avec la bonne conscience d'un
  travail fini.**
- **Une action dont on ne peut pas savoir si elle a réussi est une
  action cassée, même quand elle fonctionne.** Vécu dans les deux sens
  le même jour : le Table Editor de Supabase changeait un statut sans
  rien confirmer (le porteur du projet a cru l'écriture refusée), et les
  six actions ci-dessus faisaient l'inverse.
- **`auth.getUser()` est un aller-retour réseau, pas une lecture de
  cookie.** `/vendeur/boutique` l'appelait trois fois par page. Corrigé
  en mettant `getSessionUser`, `getMyProfiles` ET `createClient` en
  cache par requête (`cache()` de React) : sans le dernier, deux appels
  à `createClient()` produisent deux clients différents, donc deux clés
  de cache différentes, et le reste ne sert à rien.
- **Une classe Tailwind qui n'existe pas ne produit aucune erreur.** Un
  token oublié dans `tokens.css` fait disparaître un style en silence.
  D'où `npm run classes`.
- **`Intl.NumberFormat` en français** sépare les milliers par une espace
  fine insécable, illisible sur mobile. Remplacée par une espace
  insécable ordinaire dans `src/lib/format.ts`.
- **Un paramètre qui rattrape une différence de structure est le signe
  qu'il en faut deux.** `BottomNav` servait les deux espaces avec une
  liste unique de quatre onglets plus un `accountHref` pour corriger le
  dernier. Le commerçant voyait donc deux onglets qui n'existent pas
  chez lui. Le correctif n'était pas un meilleur paramètre : c'étaient
  deux listes.
- **Un correctif peut créer un défaut ailleurs.** Router un commerçant
  vers `/vendeur` a rendu son onglet « Accueil » MORT : on le touchait,
  on revenait au même écran. Un onglet qui ne fait rien est pire qu'un
  onglet absent — on réessaie, on croit l'application bloquée.
- **Un squelette de chargement qui ne ressemble pas à la vraie page fait
  sauter la page.** `loading.tsx` montrait encore la barre de recherche
  retirée de l'accueil, et affichait le squelette du fil CLIENT devant
  tout, espace commerçant compris. Un `loading.tsx` placé dans un
  dossier prend le pas sur celui du parent.
- **Un identifiant de démonstration survit à la donnée de
  démonstration.** Neuf liens de `/ecrans` pointaient sur `p-riz`,
  `m-aissatou`, `t-mariama` — les identifiants de l'ancien `mock.ts` —
  alors que la base crée des UUID. Morts depuis le branchement sur la
  vraie base, et invisibles parce que personne n'avait ouvert la page.

### Sur la méthode

- **La vérification automatique et le fait de regarder ne trouvent pas
  les mêmes défauts, et aucune des deux ne remplace l'autre.** C'est la
  leçon la plus rentable du projet. Les environnements de travail
  successifs ne pouvant pas joindre `*.supabase.co`, tout avait été
  vérifié autrement : requêtes rejouées en tant qu'anonyme réel,
  migrations rejouées sur un PostgreSQL vierge, 61 tests, build de
  production. **Le premier vrai passage sur téléphone, le 2026-09-12, a
  trouvé quatre défauts en quelques minutes** — neuf liens morts sur
  `/ecrans`, la barre d'onglets du client servie au commerçant, le fil
  client comme écran d'ouverture d'un commerçant, et une cellule
  Supabase qui échouait en silence.
- **Une décision écrite en plusieurs clauses se vérifie clause par
  clause.** `design/README.md` dit que les deux rôles n'ont ni la même
  barre d'onglets, ni le même écran d'ouverture, ni le même « Mon
  compte ». Une seule clause a été traitée, et le travail a été annoncé
  comme terminé. C'est le porteur du projet qui a dû demander « et la
  barre ? ».
- **Un plan dont les quatre cinquièmes racontent le passé ne se lit
  plus.** Arrivé à ce fichier même, le 2026-09-12 : six sous-étapes
  « 4 bis » à « 4 sexies » empilées en une journée. D'où la réécriture
  du 2026-09-13 et l'ordre actuel — ce qui reste d'abord, le journal à
  la fin.

### Sauvés de `claude/kind-thompson-khl111` avant sa fermeture

Ces trois leçons ont été payées par la v1 du projet, le 2026-09-11.
Elles ne vivaient que dans le `CLAUDE.md` de cette branche, que `main`
n'a jamais eu.

- **Un formulaire qui accepte puis oublie est pire qu'un bouton mort :
  il ment.** La v1 a annoncé « toutes les actions branchées » alors que
  RIEN n'était enregistré — publier un produit renvoyait sur une liste
  où il n'apparaissait pas. Tant qu'une action n'a pas d'effet visible à
  l'écran suivant, elle n'est pas faite.
- **Un test qui vérifie une redirection ne vérifie rien.** Les 19
  vérifications de la v1 passaient toutes : elles regardaient où l'on
  ATTERRIT après un envoi, jamais ce que l'écran d'après MONTRE. Une
  batterie de tests doit relire l'écran suivant, pas l'URL suivante.
- **Un service worker mal retiré SURVIT à son application.** Le jour où
  le chantier R6 de `docs/PERFORMANCE.md` commencera, prévoir dès le
  premier jour comment le désinstaller — sinon des téléphones resteront
  servis par une version morte de Makiti, sans aucun moyen de les
  rattraper. Sa place dans l'ordre était déjà tranchée par la v1 :
  APRÈS le branchement de Supabase, parce qu'un service worker écrit
  contre des données de démonstration serait à refaire ; seul le cache
  de la coquille, qui ne dépend d'aucune donnée, pourrait passer avant.

---

## 6. Journal — quoi, et pourquoi à ce moment-là

Le raisonnement de chaque décision vit dans les fichiers eux-mêmes
(migrations et commentaires de code, écrits pour être lus) ; les leçons
durables sont en section 5. Ce journal ne répond qu'à « quand, et
pourquoi maintenant ? ».

### 2026-09-11 — la base, l'authentification, les actions
- Projet Supabase créé et migré ; cinq migrations appliquées au tableau
  de bord sans avoir été commitées sont reconstituées depuis la base.
- **Consolidation de cinq lignes de travail divergentes dans `main`**
  (base retenue : `prochaine-etape`, la plus avancée), et correction du
  réglage « branche par défaut » de GitHub, qui pointait encore sur un
  arrêt sur image — la panne n'était pas racontée au passé, elle était
  encore active.
- Authentification complète et décision des comptes liés portée dans le
  schéma.
- Espace vendeur, messagerie, « Mon compte » et suppression de compte
  branchés sur la vraie base ; compression des photos dans le
  navigateur.
- Les quatre trous de schéma tranchés (section 3).

### 2026-09-12 — la première confrontation à la réalité
Relecture complète avec exécution de tout ce qui est vérifiable, puis
premier vrai passage dans un navigateur. Six commits, deux migrations,
neuf vérifications de sécurité de plus.

- **Quatre bugs de la couche applicative** (`1bc7f89`) : un produit
  publié pouvait perdre toutes ses photos (fermé par `0011`), six
  actions échouaient en silence, l'onglet « Compte » renvoyait un
  commerçant connecté vers l'écran de connexion, et
  `/ecrans` / `/styleguide` partaient en production.
- **`0011` appliquée sur le projet Supabase** (`2110db5`) — elle était
  commitée sans être appliquée, l'écart inverse de celui de la veille.
- **Jeu de démonstration supprimé** (`20b7f81`) et neuf liens morts de
  `/ecrans` réparés.
- **`0012` — valider une boutique en un seul geste** (`d82019b`) : la
  demande était « une colonne pour approuver », la colonne existait déjà
  (`status`, lue à neuf endroits) ; ce qui manquait, c'était que la
  changer SUFFISE.
- **Routage par rôle** (`dfe3a11`) puis **deux barres d'onglets**
  (`3db6ee2`) : un commerçant atterrissait sur le fil client et voyait
  la barre du client, contre une décision écrite depuis la maquette.
- **Maquette republiée à l'état réel** : 36 écrans, 5 corrigés, 3
  ajoutés.

**Trois erreurs d'analyse commises et corrigées en route**, notées parce
qu'elles se reproduiront : avoir affirmé qu'aucun déploiement Vercel
n'existait (il existait) ; avoir classé le routage par rôle comme
« décision produit ouverte » alors qu'une décision écrite en faisait un
bug ; avoir annoncé un travail terminé alors qu'un tiers seulement de la
règle était traité.

### 2026-09-15 — l'audit des parcours : navigation, suspensions, refus
Audit demandé par le porteur du projet sur la cohérence des parcours, à
périmètre fermé (aucune refonte, aucune fonctionnalité neuve). Ce qui en
sort, dans l'ordre de gravité :

- **Le contexte client/commerçant se perdait dans la messagerie.** Le lien
  de retour d'un fil était figé sur `/messages`, qui choisit l'espace
  CLIENT dès que les deux profils existent. Il se déduit désormais du FIL
  lui-même (`iAmMerchant`) et non d'un paramètre d'URL : une conversation
  a deux côtés, on sait toujours de quel côté on est.
- **Une boucle de redirection sur un commerçant suspendu sans compte
  client** : `/compte/suspendu` → « Voir les produits » → `/` →
  `/vendeur` → `/compte/suspendu`. `landingForSession` ne renvoie plus
  vers `/vendeur` un profil commerçant suspendu.
- **Une boutique refusée ne pouvait pas être renvoyée.** Corriger ses
  informations ne changeait pas `status`, et le commerçant n'avait aucun
  moyen de repartir vers la vérification. Migration `0015` : une fonction
  qui n'autorise QUE 'rejected' → 'pending', sur sa propre boutique.
  **Appliquée au projet Supabase le jour même** (version
  `20260915210337`), et vérifiée en base ensuite plutôt que supposée : la
  fonction est bien `security definer` avec `search_path` figé et sans
  aucun paramètre, `anon` n'a PAS le droit de l'exécuter
  (`has_function_privilege` le confirme, et l'entrée PUBLIC a bien
  disparu de l'ACL), et l'advisor Supabase ne la signale que dans la
  liste « signed-in users », jamais dans la liste « anon ».
  À noter pour la prochaine fois : le texte enregistré dans l'historique
  des migrations est la version SANS les commentaires du fichier. La
  logique est identique, mais le dépôt reste la seule copie lisible du
  raisonnement.
- Le reste : badge de non-lus sur la barre d'onglets, ville de recherche
  harmonisée, mot de passe accessible à un commerçant sans compte client,
  conditions d'utilisation qui cessent d'être un bouton mort, et les
  photos dont la suppression dans Storage attend désormais
  l'enregistrement en base.

**Vérification ciblée le même jour**, demandée avant de passer à autre
chose. Elle a trouvé deux défauts dans le travail qui venait d'être
poussé, tous deux dans la même famille (« j'ai regardé le cas nominal,
pas ses voisins ») :

- **Un chemin de photo encore cité ailleurs pouvait être détruit.**
  `product_images.storage_path` n'est unique nulle part et `imagePaths`
  vient du navigateur : une écriture sur le produit X pouvait supprimer le
  fichier du produit Y. Le ménage dans Storage vérifie désormais qu'aucune
  ligne ne cite plus le chemin avant de l'effacer.
- **`getMyMerchant` était appelée deux fois par écran vendeur** depuis que
  le badge existe. Mise en cache par requête, comme `getSessionUser` et
  `getMyProfiles` — la leçon était déjà écrite, elle n'avait pas été
  appliquée à la nouvelle lecture.

Et trois vérifications de sécurité de plus sur `0015` (74 au total) :
'approved' → 'pending' impossible, un commerçant suspendu ne renvoie pas
sa boutique, un compte client n'en trouve aucune à renvoyer.

### 2026-09-15 (suite) — le parcours d'achat, puis son contre-audit
Deuxième audit du même jour, par scénario complet cette fois : visiteur →
ville → recherche → produit → boutique → contacter le vendeur →
connexion/inscription → conversation → premier message → réponse. Lu
d'abord, corrigé ensuite, et vérifié sur un PostgreSQL local avant toute
correction — la mesure d'abord, la conclusion après.

Quatre défauts, dans l'ordre où ils font mal :

- **Une conversation devenait une page introuvable** dès que la boutique
  était suspendue (`0016`). Le client perdait l'accès à son propre
  historique sans qu'aucun écran ne le lui dise.
- **On pouvait contacter sa propre boutique** (`0016`). Le fil absurde
  n'était pas le problème : `bump_contact_count` faisait monter le
  produit dans le tri « populaires », donc un vendeur pouvait se
  recommander lui-même.
- **L'intention se perdait à l'inscription.** « Contacter le vendeur »
  → « Créer mon compte » → fil d'accueil, produit envolé. Elle voyage
  maintenant dans `?next=`.
- **Une redirection ouverte dormait déjà dans `/auth/confirm`** :
  `?next=@exemple.gn` recollé à l'origine donne une adresse dont le vrai
  domaine est `exemple.gn`.

Puis une décision du porteur du projet sur la suspension — lecture seule,
pas suppression — appliquée par `0017`, et le quota de 20 conversations
par jour qui cesse de s'afficher comme une panne réseau.

**Et surtout un contre-audit demandé ensuite**, dépôt et base relus sans
faire confiance aux messages de commit. Il a trouvé deux défauts dans le
travail des heures précédentes :

- **La protection contre la redirection ouverte se contournait** avec
  une tabulation (voir section 5). Le correctif prétendait fermer la
  porte et la laissait entrebâillée.
- **Un visiteur sans session tombait sur « Vérifiez votre connexion »**
  en ouvrant un lien de conversation, à cause de la RPC ajoutée par
  `0017` (voir section 5).

Ce que ce contre-audit dit du reste : les deux défauts étaient dans le
code applicatif, celui que rien ne teste. Les vérifications SQL, elles,
n'ont rien laissé passer — et l'une d'elles, ajoutée avant application, a
attrapé la première version de `conversation_is_open` qui répondait à des
tiers.

`0016` et `0017` sont **appliquées au projet Supabase** (versions
`20260915214106` et `20260915214137`), et vérifiées plutôt que supposées :
l'empreinte `md5(pg_get_functiondef())` de `conversation_is_open` et
celles des trois policies concernées sont identiques en local et en
production, aucun compte de ligne n'a bougé, et `execute` sur la fonction
n'est accordée qu'à `authenticated`.

### 2026-09-16 — le trou `0018`/`0019` rebouché
Une seule tâche, à périmètre fermé : rendre au dépôt les deux migrations
qui n'existaient qu'en base. Audit d'abord, reconstruction ensuite.

- **Le SQL réel relu avant d'écrire quoi que ce soit**, dans
  `supabase_migrations.schema_migrations`, puis recopié tel quel dans
  `0018_approve_a_shop_with_one_click.sql` et
  `0019_the_validation_switch_shows_its_state.sql` (`8270adb`). Aucune
  autre migration touchée, `0020` comprise : reconstituer n'est pas
  réécrire.
- **Reconstruction vérifiée, pas supposée** : 0001→0020 rejouées sur un
  PostgreSQL vierge, les 114 vérifications de sécurité passent,
  `tsc --noEmit` et `next build` aussi.
- **Cohérence avec la production vérifiée sur ce qui compte** : la
  colonne `valider`, le trigger unique `merchants_sync_approval` (les
  deux triggers de `0012` et `0018` ont bien disparu), et les empreintes
  de `sync_merchant_approval` et `reject_merchant`, identiques des deux
  côtés.
- **Un écart trouvé, volontairement non corrigé** : un commentaire de
  `approve_merchant` (`0012`) manque en production. Le corriger
  demanderait de rejouer une migration déjà appliquée, ce que la
  section 4 interdit, et pour un gain nul sur le comportement. Noté en
  dette (section 1) plutôt que fermé à chaud — c'est le mécanisme
  d'application qu'il faudra reprendre, pas ce symptôme.

### 2026-09-17 (soir) — les conditions d'utilisation existent enfin
- **Le porteur du projet a fourni le texte**, 25 articles. Il était le
  point 2 de « bloquant pour un lancement » depuis la réécriture du 13,
  et c'est la seule chose de cette liste qui ne pouvait pas s'inventer
  depuis une session de code.
- **Il vit dans `src/content/conditions.ts`**, en données et non en JSX :
  un texte juridique se relit et se corrige, et personne n'a envie de
  traverser du balisage pour changer une phrase. Même raison que
  `composeNewMessageEmail`.
- **Une seule chose a été modifiée du texte d'origine : les apostrophes**,
  uniformisées en ’ parce que la source mélangeait les deux formes. Aucun
  mot, aucune clause, aucun ordre — ce texte engage la responsabilité du
  porteur du projet, donc il ne s'améliore pas en passant par moi.
- **Écran 34, deux routes, un composant** : `/conditions` et
  `/vendeur/conditions`. Le texte est identique, le lien de RETOUR ne
  l'est pas — un commerçant qui lit les conditions depuis sa boutique ne
  doit pas revenir dans son espace d'acheteur. Même découpage que
  `ThreadScreen`, pour le même défaut.
- **`/conditions` reste publique** : l'article 25 dit qu'on accepte ces
  Conditions en créant un compte, donc les cacher derrière une
  inscription reviendrait à faire accepter un texte qu'on ne peut pas
  lire avant.
- **DEUX PROMESSES DU TEXTE NE SONT PAS TENUES, et il faut les traiter** :
  l'article 19 renvoie à une Politique de confidentialité inexistante,
  l'article 24 à un « moyen de contact indiqué sur la plateforme » qui
  n'est indiqué nulle part. Un texte qui renvoie à des documents absents
  est le même défaut qu'un bouton mort, en pire — il est opposable.
- **Une régression trouvée au passage, sans rapport** : `npm run poids`
  signale **deux polices, 60 Ko, budget 40 Ko dépassé**, alors que
  `docs/PERFORMANCE.md` décision R4 tranche « une seule police » et
  annonce 19,7 Ko tenus. `src/app/layout.tsx` charge Bricolage Grotesque
  ET Figtree. Ce n'est pas de ce travail-ci, et ce n'est corrigé par
  personne : laisser tomber une des deux est une décision d'apparence,
  pas une correction technique.

### 2026-09-17 (fin) — le SMTP posé, et les documents remis à l'heure
- **Le SMTP Resend est branché dans Supabase et fonctionne** (rapporté
  par le porteur du projet) : mot de passe oublié et confirmation
  d'inscription partent enfin par un service de production. C'était le
  dernier vrai verrou du point 1, et le plus coûteux — un commerçant
  recruté à la main puis enfermé dehors par un mot de passe oublié est un
  commerçant perdu, sans recours.
- **`README.md` et ce fichier remis à l'heure**, parce qu'ils avaient
  divergé en une seule journée : trois cases d'avancement, la section
  « emails d'authentification », la consigne d'installation qui disait
  encore de DÉSACTIVER la confirmation d'email, et le compte de tests
  figé à 61 alors qu'il y en a 153.
- **Une affirmation de ma part corrigée** : j'avais donné « l'offre Hobby
  ne déclenche les crons qu'une fois par jour » pour un fait. La
  documentation Vercel accessible ne le confirme pas. Le README dit
  maintenant d'aller LIRE « Next run » dans le tableau de bord, et donne
  les deux sorties si la fréquence ne convient pas (plan supérieur, ou
  `pg_cron` + `pg_net` côté Supabase, disponibles et non installés).
- **Et une confusion que j'avais causée** : la limite éventuelle porte
  sur le DÉLAI, jamais sur le nombre d'emails — chaque passage vide toute
  la file. Dix boutiques validées dans la journée font dix emails, pas
  un.

### 2026-09-17 (suite) — cinq décisions tranchées, deux fichiers en moins de questions
- **Le porteur du projet a répondu aux cinq questions ouvertes** : email
  de refus oui, confirmation d'email à l'inscription oui, interdiction de
  communiquer avec un compte suspendu dans les deux sens, 10 catégories,
  et le critère de validation est un APPEL téléphonique qu'il passe
  lui-même.
- **`0022` rend la suspension symétrique** : `conversation_is_open`
  exigeait que le côté BOUTIQUE soit actif, elle exige maintenant les
  deux. La policy d'envoi n'a pas été touchée — elle appelle déjà cette
  fonction, qui porte toute la règle.
- **Le défaut d'écran trouvé en écrivant la migration, et qui vaut plus
  que la migration** : le texte du fil gelé n'avait que deux branches, et
  la branche « commerçant » disait « Votre compte ne permet plus
  d'écrire ». Après `0022`, ce commerçant peut être parfaitement en
  règle et voir son fil gelé parce que SON CLIENT est suspendu — il
  lisait donc une accusation fausse, sur un écran où il n'a personne à
  qui répondre. Trois branches maintenant, et `iAmSuspended` dans
  `ThreadContext` pour les distinguer. Une règle de base qui produit un
  écran qui ment n'est pas une règle appliquée.
- **Six vérifications de plus (147 → 153)**, dont le cas miroir complet :
  le commerçant écrit tant que le client est actif, ne peut plus dès
  qu'il est suspendu, lit toujours le fil, et réécrit dès qu'il est
  rétabli. Vérifié en OMETTANT réellement `0022` : la suite tombe sur
  « client suspendu : le fil est ferme a l'ecriture ».
- **La crainte notée au point 6 était fausse, et je l'ai corrigée plutôt
  que recopiée** : ce fichier disait qu'aucun écran « vérifiez votre
  boîte mail » n'existait et qu'il faudrait en dessiner un. Le code le
  gère depuis toujours — `signUpAction` renvoie `needsConfirmation`,
  `SignupForm` l'affiche. La confirmation d'email se réduit donc à une
  case à cocher côté Supabase, APRÈS le SMTP de production.
- **`0022` n'est PAS appliquée en production, et c'est l'inverse de
  `0021`** : là-bas la table devait exister avant le code, ici le code
  doit partir avant la règle. Entre la migration et le déploiement, un
  commerçant dont le client vient d'être suspendu lirait l'ancien texte,
  c'est-à-dire l'accusation fausse. Code d'abord, migration ensuite.

### 2026-09-17 — les décisions d'administration savent enfin se dire
- **Le constat qui a lancé la journée** : trois décisions se prennent
  dans l'éditeur de table Supabase — valider, refuser, suspendre — et
  AUCUNE n'était annoncée. Un commerçant validé l'apprenait en rouvrant
  l'application de lui-même, c'est-à-dire souvent jamais, après t'avoir
  attendu 48 heures. C'était le trou le plus cher du produit, et il
  n'était écrit nulle part.
- **`0021` : une file d'attente en base**, remplie par deux triggers,
  vidée par `/api/notifications` (Vercel Cron, `vercel.json`). Le choix
  contre `pg_net` est argumenté dans la migration : un webhook n'a qu'une
  chance et son échec est invisible, une ligne qui reste se voit en une
  requête et le balayage suivant la reprend.
- **Le piège de `0018`, repris par l'autre bout** : les triggers sont
  déclarés `after update` tout court, PAS `after update of status`. La
  validation se fait en cochant `valider`, donc la commande ne mentionne
  jamais `status` — un trigger filtré sur cette colonne ne se serait
  jamais réveillé, la boutique serait passée à 'approved' et la file
  serait restée vide, sans la moindre erreur nulle part. La section 30
  des tests existe précisément pour que ce silence-là échoue bruyamment.
- **Neuf vérifications de plus** (138 → 147), dont deux qui comptent : la
  file n'est lisible par personne — elle dit ligne par ligne quel compte
  a été suspendu et quelle boutique refusée — et cocher la case remplit
  bien la file.
- **Une enveloppe HTML commune** (`emailShell`, `emailButton`,
  `emailFooter` dans `email.ts`), et les quatre emails y sont passés, le
  plus ancien compris. Quatre copies du même `<!doctype html>` divergent
  au premier changement de couleur, et un email qui ne ressemble pas aux
  autres emails du même domaine ressemble surtout à de l'hameçonnage.
- **`0021` est APPLIQUÉE en production** (projet `bfmsruzyrgbndbueikcb`),
  et vérifiée sur la base déployée : RLS active, zéro policy, zéro
  privilège restant pour `anon` et `authenticated`, les deux triggers en
  place, la file vide.
- **`database.types.ts` régénéré depuis la base déployée**, et pas
  seulement complété : le fichier avait d'abord été édité à la main
  faute de pouvoir joindre `*.supabase.co` depuis l'environnement de
  travail, puis comparé octet par octet à la vraie sortie de
  `gen types` une fois `0021` appliquée. **Aucun écart** — mais c'est la
  comparaison qui le dit, pas la confiance.
- **Ce qui a été CORRIGÉ dans ce fichier, et qui est la vraie leçon du
  jour** : le point 1 annonçait l'email de message comme « le seul vrai
  verrou » alors qu'il était écrit et mergé depuis le 2026-09-16, et le
  point 9 donnait le temps réel comme « à brancher » alors que
  `RealtimeThread` tourne depuis `0014`. Un fichier de reprise qui
  retarde envoie la session suivante refaire ce qui est fait — exactement
  ce que sa réécriture du 13 devait empêcher.
- **Ce qui reste, et qui n'est pas du code** : le SMTP Resend côté
  Supabase (les emails d'authentification ne passent PAS par
  `RESEND_API_KEY`), `CRON_SECRET` sur Vercel, et la fréquence réelle du
  cron sur l'offre Hobby — une fois par jour, quelle que soit
  l'expression écrite dans `vercel.json`. Ces deux derniers points n'ont
  pas pu être vérifiés d'ici : le compte Vercel ne répond pas aux outils
  de cette session.
- **Les tests SQL ne se lancent JAMAIS contre la production** : leur
  première instruction est `truncate auth.users cascade`. Ils tournent
  sur un PostgreSQL local, migrations rejouées depuis zéro — c'est ce
  qui a été fait, 147 vérifications au vert.

### 2026-09-13 — le fichier de reprise, puis les écritures aveugles
Aucun changement de code. Ce fichier réécrit de zéro : « ce qui reste »
passe en tête, l'archéologie des branches est réduite aux règles qui en
sortent, et l'état du dépôt est revérifié — 4 branches distantes et non
2, dont deux supprimables sans perte (point 14).

Puis **audit du fichier contre le code**, plutôt que recopie de ce que
l'ancienne version affirmait. Il en sort une correction de fond : le
compteur de non-lus était listé comme restant à faire alors qu'il est
fait de bout en bout depuis le schéma jusqu'à l'écran ; seul le badge
de la barre d'onglets manque (point 1). **Un fichier de reprise qui
surestime ce qui reste coûte autant qu'un qui le sous-estime** — il
fait repartir de zéro un travail déjà payé.

Puis, `main` remise à jour : l'écran 32b (signaler une conversation avec
un vrai motif) fusionné depuis la branche `transpose-thomson`, et **les
écritures qui pouvaient échouer en silence** fermées. Un `grep` sur
`.insert(`, `.update(` et `.delete()` en avait listé quatorze ; la
mesure sur PostgreSQL a ramené le vrai périmètre à cinq `update`/`delete`
plus deux écritures `service_role` de la suppression de compte qui
n'inspectaient rien. Voir la leçon rectifiée en section 5 — la première
formulation avait fait corriger les mauvais endroits.

L'environnement de travail peut désormais **exécuter les tests** : un
PostgreSQL local monté dans le bac à sable rejoue les 13 migrations
depuis une base vierge et passe les 61 vérifications de sécurité. C'est
la première session où cette propriété est constatée plutôt que citée.

**Et regarder les écrans** : Chromium pilote `npm run dev` en 400 px.
Deux défauts vus immédiatement, du même genre que ceux du 12/09 :
`getSessionUser` ignorait l'erreur de `auth.getUser()`, donc une base
injoignable se faisait passer pour une absence de connexion — `/messages`
répondait « Aucune conversation » sans avoir pu regarder ; et `/messages`
ne redirigeait pas un visiteur anonyme là où `/compte` le faisait.

**Ce qui reste hors de portée depuis ici, et pourquoi** : ni
`*.supabase.co` ni `*.vercel.app` ne sont joignables (403 de la politique
d'egress de l'organisation), et les images Docker non plus, donc pas de
pile Supabase locale. Conclusion pratique : une session peut vérifier le
rendu, la largeur, les redirections et le comportement base injoignable ;
elle ne peut pas voir un écran portant de vraies données. La messagerie
entre deux comptes, l'envoi d'une photo et le refus d'une boutique
restent à regarder sur un vrai téléphone.

### 2026-09-19 — le cron rendu compatible avec l'offre Hobby

- **Le symptôme : plus AUCUN déploiement ne passait**, y compris ceux qui
  ne touchaient ni au cron ni aux emails. C'est le point important à
  retenir : une planification invalide ne casse pas seulement le cron,
  elle ferme la porte à tout le projet.
- **La cause : `vercel.json` demandait `*/10 * * * *`**, soit 144
  passages par jour, alors que l'offre venait de passer de payante à
  Hobby — un plan qui ne déclenche un cron qu'une fois par jour. Vercel
  ne réécrit pas l'expression en silence : il refuse.
- **Le correctif : `0 7 * * *`**, une seule ligne, choisie parce qu'elle
  est la fréquence maximale que l'offre accepte et que 7 h UTC = 7 h à
  Conakry, donc la file part avant la journée de travail.
- **Ce que ça coûte, et il faut le dire franchement : le délai.** Une
  boutique validée à 8 h attendra son email jusqu'au lendemain matin.
  Le NOMBRE d'emails n'a jamais été en cause — chaque passage vide toute
  la file.
- **Aucun code applicatif n'a bougé**, et c'est exactement ce que la file
  en base achetait : `/api/notifications` se moque de savoir qui l'appelle
  et à quel rythme, donc changer de planificateur ne demandera pas de
  relire une ligne de TypeScript.
- **Ce qui reste ouvert, à trancher par le porteur du projet** : accepter
  les 24 h ; ou appeler la route depuis une action GitHub programmée
  (gratuite, toutes les 15 min, au prix de deux secrets à poser dans le
  dépôt et d'un deuxième endroit où lire les journaux) ; ou la planifier
  depuis Supabase avec `pg_cron` + `pg_net` ; ou repasser au plan payant.
- **Une correction à ma charge** : le document affirmait que Vercel
  « peut réécrire cette expression ». C'était faux, et l'erreur a coûté
  un blocage de déploiement — il refuse le déploiement entier.
- **Et une règle Git révisée dans la foulée** (`CLAUDE.md`) : `main`
  devient la branche de travail ET la branche déployée, parce que la
  branche intermédiaire que la règle du 16/09 désignait avait disparu en
  laissant 7 commits jamais fusionnés — une consigne qui pointe une
  branche morte égare au lieu de protéger.
- **Ce qui reste éparpillé, et n'a PAS été touché** : trois branches
  distantes portent 61 commits absents de `main` (`profile-city-edit`
  36, `kind-thompson` 18, `verify-main-branches` 7). Un inventaire de ce
  qu'elles contiennent réellement reste à faire avant toute fusion ou
  suppression.

### 2026-09-19 (suite) — cinq chantiers rapatriés, une branche fermée

- **Trois branches ont été inventoriées fichier par fichier** avant toute
  décision, parce qu'une branche qu'on supprime sans l'avoir lue emporte
  ce qu'elle était seule à contenir.
- **`claude/profile-city-edit-5cxvjb` (36 commits) : rien d'unique.** Ses
  deux chantiers annoncés — ville de résidence, suppression de compte —
  sont dans `main` depuis le 2026-09-13, et ses fichiers « uniques » sont
  des ancêtres de ce que `main` a réécrit (dont un `BottomNav` supprimé
  exprès parce qu'il affichait la mauvaise barre sur six écrans).
- **Décision du porteur du projet, le 2026-09-19 : `profile-city-edit`
  est à SUPPRIMER**, rien n'en étant repris. Contre-vérification faite
  avant de trancher : ses 26 fichiers au chemin inconnu de `main` sont
  les 25 routes à plat que `main` a réorganisées en groupes de routes,
  plus un `BottomNav.tsx` que `main` a supprimé exprès. Son journal n'est
  pas recopié non plus : `main` raconte déjà la consolidation du
  2026-09-11 et l'épisode de la branche par défaut GitHub, deux fois.
- **La suppression elle-même n'a pas pu être exécutée depuis une session
  Claude** : le proxy réseau renvoie HTTP 403 sur toute suppression de
  branche distante, alors que les pushs de commits passent. À faire
  depuis l'onglet « Branches » de GitHub — pour `profile-city-edit` comme
  pour `verify-main-branches`, dont le contenu utile est déjà dans `main`.
- **`claude/kind-thompson-khl111` (18 commits) : la v1 du projet**, sur
  des données en mémoire et sans Supabase. Son code ne se recolle pas,
  mais six idées y restent vivantes et ABSENTES de `main` : la table
  « hors périmètre » (7 familles), la validation du numéro guinéen
  (`^6\d{8}$`), le bandeau « Pas de connexion », les filtres en puces
  avec compte par option, la pagination `?n=` et l'avertissement sur la
  désinstallation d'un service worker. **Trois de ces idées ont été
  reprises le 2026-09-19** — la validation du numéro
  (`src/lib/telephone.ts`), le bandeau hors ligne
  (`src/components/ui/OfflineBanner.tsx`) et les trois leçons de la
  section 5. **La table « hors périmètre » a été écartée par le porteur
  du projet**, l'état vide de la recherche restant tel quel. Restent
  non repris : les filtres en puces avec compte par option et la
  pagination `?n=`, qui demanderaient une réécriture de la recherche et
  non une reprise.
- **`claude/verify-main-branches-pe8bp4` (7 commits) : rapatriée et
  fermée.** Cinq commits rejoués sur `main` par `cherry-pick -x`, deux
  abandonnés, puis la branche supprimée sur autorisation du porteur du
  projet.
- **Ce qui est arrivé dans `main` par ce rapatriement** : les gardes
  d'espace sur les trois feuilles du fil (+ une règle dans
  `scripts/verifier-espaces.mjs`), l'espace marchand à quatre onglets,
  la séparation consultation/édition de la boutique, la double saisie du
  mot de passe (`src/lib/password.ts`), et le mot de passe actuel exigé
  pour enregistrer la boutique (`src/lib/supabase/verify.ts`).
- **Ce qui a été abandonné, et pourquoi** : sa page de conditions
  d'utilisation, parce que `main` a le même texte dans une meilleure
  forme (texte isolé du JSX, une route par espace) ; et sa
  documentation, antérieure de trois jours à celle de `main`.
- **Vérifications passées avant le push** : `typecheck`, `build`,
  `espaces` (99 fichiers), `gardes` (13 cas) et `classes` (129 fichiers),
  tous verts — c'est la contrepartie exigée par `CLAUDE.md` depuis que
  `main` est la seule branche.
- **Deux inexactitudes corrigées au passage** : `docs/ECRANS.md` et le
  `README.md` annonçaient 33 ou 34 écrans là où `/ecrans` en liste 36
  depuis ce rapatriement.

### 2026-09-19 (fin) — les filtres s'ouvrent au-dessus des résultats

- **Les deux pages de filtres ont été supprimées** (`/recherche/filtres`
  et `/recherche/ville`) : une page entière cachait exactement ce qu'on
  essayait de filtrer, et imposait deux navigations pour un choix.
- **Les trois filtres — ville, catégorie, tri — s'ouvrent maintenant dans
  un panneau flottant** (`src/components/ui/FilterChip.tsx`), étroit et
  plafonné à 55 % de la hauteur, pour qu'on continue de voir la liste
  derrière.
- **Aucun JavaScript : c'est un `<details>`**, donc le panneau s'ouvre
  avant même que le socle JS soit chargé (`docs/PERFORMANCE.md`, R3).
- **Une contrainte à ne pas casser** : la rangée de puces passe à la ligne
  et ne défile PAS horizontalement — un parent en `overflow-x: auto`
  découperait les panneaux, parce que rogner horizontalement rogne aussi
  verticalement.
- **Un token d'ombre ajouté** (`--shadow-panel`) : Makiti se dessine avec
  des bordures, mais un élément qui flotte a besoin de dire lequel des
  deux plans est devant.
- **Décisions du porteur du projet** : pas de filtre neuf/occasion (la
  colonne n'existe pas et c'est une décision produit), pas de compteur par
  option pour l'instant (chacun coûterait une requête d'agrégat, et
  afficherait 0 ou 1 sur un catalogue encore vide).

---

## 7. Le vrai risque

Le code est presque fait ; ce n'est pas là que le projet se joue.

Une marketplace vide n'attire aucun client, et sans clients aucun
commerçant ne reste. Recruter les vingt premiers commerçants — sur **un
seul marché**, la densité battant le volume — est le travail le plus
difficile du projet, et il ne s'écrit pas en TypeScript.
