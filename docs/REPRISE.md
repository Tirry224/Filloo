# Reprendre le travail sur Makiti

Point d'entrée pour continuer le projet dans une nouvelle conversation.
Il dit **ce qui reste**, **ce qui est fait**, **ce qui est déjà tranché**
(pour ne pas le rediscuter) et **ce qui a déjà fait mal** (pour ne pas le
refaire).

Dernière mise à jour : **2026-09-15** (audit des parcours — voir le
journal). Réécrit de zéro le 2026-09-13, parce
que le plan était devenu illisible : quatre cinquièmes du document
racontaient le passé, et « ce qui reste » vivait en section 3, après 330
lignes d'archéologie de branches. Un fichier de reprise qu'on ne lit plus
ne reprend rien.

**État en une phrase :** l'application est complète et branchée sur la
vraie base, elle est en ligne, et il lui manque les emails pour pouvoir
être ouverte à de vrais commerçants.

---

## 1. Ce qui reste à faire

### Bloquant pour un lancement

**1. Les emails (Resend).** C'est le seul vrai verrou. Deux besoins
distincts, un seul fournisseur :

- **Notification de nouveau message par email.** Sans elle, la
  messagerie est une boîte aux lettres que personne ne relève : un
  commerçant qui n'est jamais prévenu ne revient pas, et le produit
  entier repose sur cette messagerie.
  *Vérifié le 2026-09-13 — le compteur de non-lus, lui, est déjà fait
  de bout en bout* : `messages.read_at` existe (`0001`), le RLS
  n'autorise l'écriture QUE de cette colonne (`0002`),
  `src/lib/data/messages.ts` calcule `unreadCount` depuis la vraie
  base, `ThreadRow` l'affiche par fil, et ouvrir un fil marque ses
  messages comme lus (`src/app/messages/[id]/page.tsx`). **Le badge
  global de la barre d'onglets est fait depuis le 2026-09-15** :
  `countUnreadMessages` (`src/lib/data/messages.ts`) le compte PAR ESPACE,
  `BottomNav` le porte, et « Mes produits » affiche enfin son second
  chiffre. Reste donc le seul vrai manque de ce point : l'email, qui
  prévient quand personne ne regarde l'écran.
- **Emails d'authentification** — réinitialisation de mot de passe, et
  confirmation d'inscription si elle est réactivée.
  `/mot-de-passe-oublie` promet noir sur blanc « vous recevrez un
  lien » ; cette promesse dépend aujourd'hui du serveur mail intégré de
  Supabase, que leur propre documentation déclare non destiné à la
  production (quelques envois par heure, au mieux). **Un écran qui
  promet ce que le système ne tient pas est un bug, pas une
  approximation.**

**2. Le texte des conditions d'utilisation.** La ligne existe dans deux
écrans (`/compte`, `/vendeur/boutique`) mais ne mène nulle part : il
manque le TEXTE, pas le code. Makiti est un intermédiaire technique, non
une partie à la vente — à écrire avant le premier litige, pas pendant.
*Le 2026-09-15, la ligne a au moins cessé d'être un BOUTON mort* : un
`MenuItem` sans `href` ni action rend désormais une ligne d'information
(« Bientôt ») au lieu d'un bouton qu'on touche sans effet. Le texte, lui,
reste entièrement à écrire — il ne s'invente pas depuis une session de
code.

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

**5. Sur quel critère concret une boutique est-elle validée ?** La
mécanique est prête depuis la migration `0012` : changer
`merchants.status` suffit. Mais sans critère écrit, tu approuveras tout
en y passant du temps — c'est-à-dire une validation manuelle qui coûte
sans filtrer. Un numéro qui répond ? Une photo de la devanture ? Une
rencontre ?

**6. Confirmation d'email : oui ou non ?**
*Pour* : l'email est à la fois identifiant de connexion ET canal de
notification, donc sans confirmation quelqu'un peut s'inscrire avec
l'adresse d'un tiers, qui recevra les messages d'un inconnu.
*Contre* : une friction de plus, sur un marché où il faut déjà arracher
les vingt premiers commerçants.
À savoir avant de trancher : **aucun écran « vérifiez votre boîte mail »
n'existe dans la maquette** — la réactiver demande d'en dessiner un.

**7. Catalogue de lancement : 8 catégories ou 10 ?** La base en a 10.
`kind-thompson` en proposait 8. C'est une décision produit, à trancher
avant de la traduire en migration.

**8. Le parcours vers le compte lié.** Pas un bug, une observation de
terrain : le porteur du projet lui-même, en testant, a créé DEUX
CONNEXIONS distinctes au lieu d'un second profil lié sur la même
connexion. L'écran d'inscription ne propose le compte lié qu'à une
personne DÉJÀ connectée — ce qui n'est pas le réflexe de quelqu'un qui
veut « aussi vendre ». Si le porteur du projet se trompe, l'utilisateur
se trompera.

### Non bloquant

**9. Temps réel de la messagerie.** Le fil se recharge à la navigation,
pas à l'arrivée d'un message pendant qu'on le lit. Supabase Realtime
reste à brancher. Assumé comme non bloquant : une marketplace de mise en
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

- **Aucun test automatisé côté front.** 74 tests couvrent le SQL, zéro
  couvre la couche applicative — là où se trouvaient les quatre bugs du
  2026-09-12. C'est le déséquilibre de fond du projet : la couche la
  mieux testée n'est pas celle qui casse.
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
2026-09-11. `supabase/migrations/` — 15 fichiers SQL, à exécuter dans
l'ordre sur un projet neuf. **`0015` est la seule qui ne soit pas encore
appliquée au projet Supabase** (voir le journal du 2026-09-15) :

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

Chaque migration est écrite pour être lue : le raisonnement complet est
dans le fichier, pas ici.

**Les 15 migrations rejouent depuis une base vierge** — vérifié, pas
supposé (`supabase/tests/README.md` donne la commande). C'est la seule
propriété qui compte pour une suite de migrations, et celle qui casse le
plus discrètement.

`supabase/tests/` — **74 vérifications de sécurité**, rejouables sur un
PostgreSQL local. Elles vérifient que les actions **interdites**
échouent, et ont déjà trouvé **trois vraies failles** (section 5).

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
  **Commitée, PAS encore appliquée au projet Supabase** — l'environnement
  de travail ne joint toujours pas `*.supabase.co`. C'est l'écart que la
  règle de travail interdit : à appliquer au tableau de bord avant tout
  autre travail sur la base.
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

---

## 7. Le vrai risque

Le code est presque fait ; ce n'est pas là que le projet se joue.

Une marketplace vide n'attire aucun client, et sans clients aucun
commerçant ne reste. Recruter les vingt premiers commerçants — sur **un
seul marché**, la densité battant le volume — est le travail le plus
difficile du projet, et il ne s'écrit pas en TypeScript.
