# Reprendre le travail sur Makiti

Point d'entrée pour continuer le projet dans une nouvelle conversation.
Il dit **ce qui reste**, **ce qui est fait**, **ce qui est déjà tranché**
(pour ne pas le rediscuter) et **ce qui a déjà fait mal** (pour ne pas le
refaire).

Écrit de zéro le **2026-09-21**, après vérification de chaque affirmation
contre le code. La version précédente faisait 1506 lignes, dont 725 de
journal chronologique — c'est-à-dire une réécriture manuelle de
`git log`, qui vieillissait sans que personne ne la relise. **Ce fichier
n'a plus de journal : l'histoire est dans Git, qui ne se trompe jamais de
date.** Ce qu'il garde est ce que Git ne sait pas dire : pourquoi une
décision a été prise, et quelle erreur a coûté une journée.

**État en une phrase :** l'application est complète, branchée sur la
vraie base et en ligne ; ce qui la sépare d'un vrai commerçant n'est plus
du code mais deux constats à faire de tes propres yeux — un email reçu et
un parcours fait sur un téléphone.

**Mise à jour du 2026-09-22.** Une session a repris ce fichier après avoir
corrigé les six défauts listés plus bas, ajouté le partage (Open Graph,
sitemap, robots), la politique de confidentialité, l'écran de contact, les
compteurs d'usage et les premiers tests de la couche applicative. Elle a
aussi EXÉCUTÉ, pour la première fois depuis une session, les tests de
sécurité SQL : **158 vérifications, toutes au vert**, sur un PostgreSQL 16
local portant les 24 migrations. Le chiffre ne se recopie plus d'un
document à l'autre — il sort du script.

**Et une preuve qui change le statut d'un blocage.** La file
`notifications` de la base de production portait, le 2026-09-21, une ligne
`merchant_approved` créée le 17 et **jamais envoyée — quatre jours
d'attente**. Le cron tourne tous les jours à 7 h : il a donc échoué quatre
fois. « À constater » n'est plus le bon mot : la chaîne d'envoi est
CASSÉE, et un commerçant validé n'a jamais appris qu'il l'était.

**Ce qui a été vérifié pour écrire ce fichier, et ce qui ne l'a pas
été.** Tout ce qui porte sur le dépôt a été relu dans le code le
2026-09-21. Tout ce qui porte sur la production (Vercel, Supabase, une
boîte email) ne l'a pas : cette session n'a pas accès aux variables Vercel
(403), ne joint pas `*.supabase.co`, et ne peut donc rien constater en
ligne. Les points concernés sont marqués **« à constater »** — ils ne
sont ni faits ni cassés, ils sont invérifiables d'ici.

Ce qui a été EXÉCUTÉ le 2026-09-21, et pas seulement lu : `npm run
typecheck`, `npm run build` et `npm run poids` passent, ce dernier
annonçant **165,4 Ko de socle pour 200, une police préchargée à 19,7 Ko
pour 40, et 12,0 Ko sur `/conditions` pour 12** — tous les budgets sont
tenus, celui de la page la plus lourde de justesse.

---

## 1. Ce qui reste à faire

### Bloquant pour ouvrir à un vrai commerçant

- **Constater un email réellement reçu.** Le code est écrit, Resend est
  branché, le SMTP est posé côté Supabase depuis le 2026-09-17 — mais
  personne n'a encore vu un email arriver dans une vraie boîte. *À
  constater.* Une chaîne d'envoi non observée est une hypothèse.
- **`CRON_SECRET` sur Vercel.** Sans elle, `/api/notifications` refuse
  tout et aucune décision d'administration (boutique validée, refusée,
  compte suspendu) n'est annoncée. *À constater* : cette session ne peut
  pas lire les variables du projet.
- **`NEXT_PUBLIC_SITE_URL` sur Vercel.** C'est un second `CRON_SECRET`,
  et il est passé sous le radar de toutes les listes de blocages
  jusqu'au 2026-09-19 : sans elle, **AUCUN email ne part** —
  `notifications.ts` se contente d'un `console.error`. Elle n'est pas
  dans le `.env` versionné. *À constater.*
- **Activer la confirmation d'email côté Supabase.** Décidée (SPEC,
  décision 1), le code la gère déjà de bout en bout (`needsConfirmation`
  dans `signUpAction`, message d'attente dans `SignupForm`). C'est une
  case à cocher, pas un écran à dessiner — **et elle ne se coche
  qu'après le SMTP**, sinon plus personne ne peut s'inscrire.
  ⚠️ **À faire AVANT de cocher** : `signUpAction` ne passe pas
  d'`emailRedirectTo` (voir les dettes). Le lien de confirmation
  ramènera donc à la racine du site, et le produit que la personne
  voulait contacter sera perdu.
- **Les libellés des 10 catégories et la liste des villes.** Le NOMBRE
  est tranché (10, décision 3 de SPEC) ; les mots, non. Ils s'affichent
  sur le premier écran de l'application : c'est la première chose qu'un
  visiteur lit, et elle n'est pas décidée.

### Les deux promesses écrites sont tenues depuis le 2026-09-22

- **Article 19 → une Politique de confidentialité** : écrite
  (`src/content/confidentialite.ts`), servie par `/confidentialite` et
  `/vendeur/confidentialite`, atteignable depuis les deux menus « Mon
  compte » et citée sous le bouton d'inscription.
- **Article 24 → un moyen de contact** : `/contact` et `/vendeur/contact`,
  avec l'adresse `bouliwelltirry@gmail.com` — la même que celle qui reçoit
  les réponses aux emails de refus de boutique.

**Il reste UNE case à remplir**, et elle est bloquante pour un document
juridique : `EDITEUR_NOM` dans `src/content/confidentialite.ts` est vide.
Une politique de confidentialité doit nommer le responsable du traitement.
L'écran s'adapte — il tait le bloc plutôt que d'afficher un nom inventé,
ce qui rendrait le document entier suspect — mais la promesse n'est
complète qu'une fois ces deux chaînes remplies (nom civil, puis ville).

### À faire sur un vrai téléphone, par toi

L'environnement de travail des sessions ne joint ni `*.supabase.co` ni
`*.vercel.app`, et ne peut pas lancer de pile Supabase locale (images
Docker bloquées). Une session voit donc le rendu et le comportement
« base injoignable », **jamais un écran portant de vraies données**. Ces
trois parcours n'ont jamais été vus fonctionner par personne :

- la **messagerie entre deux comptes réels** ;
- l'**envoi d'une photo depuis un téléphone** ;
- le **parcours de refus d'une boutique**.

`/ecrans` liste les 36 écrans et allume chaque lien dès que
l'enregistrement correspondant existe. **Noter les défauts au fil de
l'eau plutôt que les corriger un par un** — ils se traitent mieux en
lot, et corriger en cours de parcours fait perdre le fil du parcours.

### Les six défauts : cinq corrigés le 2026-09-22, un laissé ouvert

Ils étaient écrits ici pour ne pas être retrouvés une troisième fois. Ce
qui suit dit ce qui a été fait, pour ne pas les chercher une quatrième.

- **`countProductsElsewhere` affichait un chiffre faux** — CORRIGÉ. Elle
  demandait `p_limit: 500` là où `search_products` plafonne à 50. Elle
  rend maintenant `{ nombre, atteintLePlafond }`, et l'écran écrit « 50
  produits ou plus » plutôt qu'un total qu'il ne connaît pas.
- **Supprimer un produit abandonnait ses photos pour toujours** —
  CORRIGÉ. `deleteProductAction` lit les chemins AVANT le `delete` (la
  cascade efface `product_images`, seul endroit où ils vivent), puis fait
  le même ménage que `updateProductAction`, contrôle des fichiers encore
  cités par un autre produit compris.
- **Un échec partiel de création de produit était sans issue** — CORRIGÉ.
  Le réessai tombait sur un `duplicate key` brut, en anglais, sans porte
  de sortie : `ProductForm` fige l'identifiant, donc recharger ne changeait
  rien. `createProductAction` traite désormais le code `23505` comme ce
  qu'il est — la REPRISE d'un brouillon — et met à jour au lieu de refuser.
- **Publier un produit reste impossible sans JavaScript** — NON CORRIGÉ,
  et c'est le seul du lot. `PhotoPicker` téléverse depuis le navigateur et
  `check_product_publishable` exige une photo. Y remédier demande un
  chemin de téléversement côté serveur (route multipart, validation du
  type et du poids, écriture dans Storage), c'est-à-dire un vrai
  développement et non un correctif — à décider, pas à bâcler.
- **Aucune interface d'administration n'existe** — c'est une DÉCISION de
  v1 (section 4), pas un défaut. Elle reste vraie.
- **Le commentaire de la migration `0023` est faux** — le rectificatif vit
  ici, et une migration appliquée ne se réécrit pas.

### Ce que la session du 2026-09-22 a ajouté

- **Le partage.** `generateMetadata` sur la fiche produit (titre, prix,
  photo) et sur la fiche boutique, plus `metadataBase`. Sans elles, un
  lien collé dans WhatsApp — le canal de diffusion réel en Guinée —
  s'affichait avec le titre générique du site, sans photo ni prix.
  **Les balises ne sont PAS posées à la racine** : mesuré, `og:type` et
  `og:site_name` seuls coûtaient 0,2 Ko sur CHAQUE écran et faisaient
  passer `/conditions` de 12,0 à 12,2 Ko, au-dessus du budget de
  `npm run poids`. Payer sur trente-huit écrans ce qui n'en sert que deux
  était le mauvais sens du calcul.
- **`sitemap.ts` et `robots.ts`.** Le plan du site est construit avec un
  client ANONYME (`src/lib/supabase/public.ts`) : c'est le RLS qui décide
  de la liste, donc un produit masqué, en brouillon, supprimé ou d'une
  boutique refusée en disparaît sans qu'aucune condition ne soit écrite
  deux fois. Un produit vendu y reste mais porte un `noindex`.
- **La politique de confidentialité et l'écran de contact**, les deux
  promesses des articles 19 et 24 que rien ne tenait. Écrites à partir du
  CODE : l'article « Supprimer votre compte » dit que la suppression
  anonymise et bannit, et n'efface ni les messages passés ni l'adresse
  email — parce que c'est ce que fait `deleteAccountAction`.
- **L'inscription nomme enfin les conditions.** L'article 25 fait reposer
  leur acceptation sur le bouton « Créer mon compte », et cet écran n'en
  disait pas un mot : on faisait accepter un texte sans jamais le montrer.
- **Les compteurs d'usage** (`0024`, `src/lib/analytics.ts`) : onze
  événements, mesurés côté SERVEUR, zéro octet de JavaScript envoyé au
  téléphone, aucune bannière de consentement, aucune donnée identifiante.
  La table refuse `anon` et `authenticated` des DEUX côtés — RLS sans
  policy et privilèges révoqués — ce qui a été vérifié en `set role anon`,
  pas supposé.
- **Les premiers tests de la couche applicative** : `npm run tests`, 25
  cas sans aucune dépendance (`node --test`). Les quinze cas qui avaient
  trouvé le contournement de `safeNextPath` vivaient dans `/tmp` et
  pouvaient donc disparaître ; ils sont maintenant dans le dépôt. Un de
  ces tests a d'ailleurs trouvé une erreur d'attente de son auteur, pas du
  code — c'est précisément à ça qu'ils servent.
- **Une seule façon de connaître l'adresse du site** (`src/lib/site-url.ts`)
  au lieu de deux, et surtout un FILET : à défaut de
  `NEXT_PUBLIC_SITE_URL`, elle se rabat sur
  `VERCEL_PROJECT_PRODUCTION_URL`, que Vercel pose seul. Oublier la
  variable n'éteint donc plus tous les emails en silence.
- **`?next=` traverse désormais le parcours « mot de passe oublié »** en
  entier, et `signUpAction` passe un `emailRedirectTo`. Les deux chemins
  par lesquels l'intention se perdait sont fermés — le second était
  bloquant le jour de l'activation de la confirmation d'email.

### Deux gestes de ménage, non bloquants

- **Supprimer `/ecrans` et `/styleguide`** une fois le parcours
  ci-dessus terminé. Introuvables en production aujourd'hui, mais une
  page de travail qu'on oublie de retirer finit par être trouvée.
- **Regarder le projet Supabase « Fillo »** du 2026-08-25, qui tourne
  encore à côté de `Makiti` sans qu'on sache s'il sert.
- **Supprimer les onze branches `claude/*` restées sur GitHub.**
  Inventoriées le 2026-09-21, commit par commit : **aucune ne porte de
  contenu absent de `main`** — les 17 commits qui ne sont pas des
  doublons exacts ont tous été repris ailleurs, réécrits en anglais ou
  délibérément annulés. Le geste n'a pas pu être fait depuis une
  session : le relais Git refuse la suppression de références (403 sur
  `git push --delete`, alors que `--dry-run` passe) et aucun outil
  GitHub disponible ne supprime une branche. **À faire depuis une
  machine où `git` parle directement à GitHub.**

### Une observation de terrain, pas un bug

**Le parcours vers le compte lié ne se trouve pas tout seul.** Le
porteur du projet lui-même, en testant, a créé DEUX CONNEXIONS
distinctes au lieu d'un second profil lié sur la même connexion :
l'écran d'inscription ne propose le compte lié qu'à une personne DÉJÀ
connectée, ce qui n'est pas le réflexe de quelqu'un qui veut « aussi
vendre ». Si celui qui a conçu le produit se trompe, l'utilisateur se
trompera.

### Dettes techniques connues, aucune bloquante

- **La couche applicative est désormais testée, mais à peine.**
  `npm run tests` couvre 25 cas : `safeNextPath`, les règles de saisie et
  l'adresse du site. C'est le socle, pas la couverture — les actions
  serveur, elles, n'ont toujours aucun test, et c'est là que vivent les
  écritures. La phrase qui suit reste vraie et explique pourquoi ce
  déséquilibre coûte cher.

  *Ancien état, conservé pour la leçon :* deux mille lignes de tests
  couvraient le SQL, aucune ne couvrait la couche applicative — c'est-à-dire
  là où TOUS les bugs de terrain ont été trouvés. C'est le déséquilibre
  de fond du projet : la couche la mieux testée n'est pas celle qui casse.
  Les quinze cas qui ont trouvé le contournement de `safeNextPath` ont
  été exécutés depuis `/tmp` et ne sont pas dans le dépôt : le même
  défaut peut revenir sans que rien ne le dise. Node 22 exécute
  `node --test` sans installer quoi que ce soit — il n'y a même plus
  l'excuse de la dépendance.
- ~~**`?next=` se perd sur deux chemins**~~ — CORRIGÉ le 2026-09-22 :
  `signUpAction` passe un `emailRedirectTo` et le lien « Mot de passe
  oublié ? » emporte `next` sur tout le parcours. Conservé ci-dessous
  parce que la description dit ce qui était en jeu. Vérifié le
  2026-09-21 : `signUpAction` ne passe pas d'`emailRedirectTo`
  (`src/lib/actions/auth.ts:72`), et le lien « Mot de passe oublié ? »
  de `LoginForm` ne transporte pas `next`. Latent tant que la
  confirmation d'email est désactivée — et bloquant le jour où on
  l'active.
- ~~**L'origine des liens de réinitialisation vient de l'en-tête
  `Host`**~~ — CORRIGÉ le 2026-09-22 : `src/lib/site-url.ts` est le seul
  endroit qui décide de cette adresse, et il ne lit aucune requête. Le
  texte d'origine
  (`src/lib/actions/auth.ts:185`), qui n'est pas validé. Non exploitable
  — Supabase filtre `redirectTo` — mais la protection vit dans un
  réglage de tableau de bord au lieu du dépôt. **Et le correctif est
  déjà à moitié là** : `NEXT_PUBLIC_SITE_URL` existe et sert déjà dans
  `notifications.ts`, `notifications-decisions.ts` et `push.ts`. Deux
  façons de construire la même URL dans le même dépôt, c'est une de
  trop.
- **Le dépôt et la production ne portent pas les mêmes commentaires
  SQL.** Le mécanisme d'application retire les commentaires ; la logique
  est identique, seul le raisonnement se perd, et le dépôt en reste la
  seule copie lisible. **À traiter en corrigeant le mécanisme une seule
  fois, jamais en réécrivant une migration déjà appliquée.** Conséquence
  à connaître : comparer les empreintes `md5(pg_get_functiondef())`
  entre local et production produit des faux positifs sur toute fonction
  commentée, donc ne prouve rien seule.
- **Sept blocs `exception when others` dans `security_test.sql`.** Celui
  du quota des 100 messages/jour affiche `OK` sans vérifier le
  `sqlstate` : un refus RLS ou une faute de frappe dans le jeu de
  données produiraient le même vert. Le test du quota de conversations,
  lui, exige `P0001` — les deux devraient se ressembler.
- **`middleware` est déprécié en Next 16** :
  `npx @next/codemod@canary middleware-to-proxy .`. Le faire débloquerait
  aussi un vrai 404 sur `/ecrans`, aujourd'hui un 200 qui porte la page
  « n'existe pas ».
- ~~**`postcss` n'est pas déclaré dans `package.json`**~~ — CORRIGÉ le
  2026-09-22 : il est maintenant une dépendance de développement
  déclarée, et ne tient plus par accident à la dépendance transitive de
  `@tailwindcss/postcss`.
- **Une vingtaine de commentaires de code renvoient à ce fichier par
  un numéro** (« étape 2 », « section 7 », « point 9 »). Ces numéros
  désignaient un plan disparu depuis plusieurs réécritures : ils sont
  déjà faux aujourd'hui, et le resteront tant qu'on numérotera ce à quoi
  le code fait référence. **À corriger en citant un TITRE de section,
  jamais un numéro.**
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

Chiffres comptés dans le dépôt le 2026-09-21, pas recopiés.

### Base de données — écrite, testée, déployée

- **23 migrations** dans `supabase/migrations/`, de `0001_schema.sql` à
  `0023_a_phone_can_be_reached_when_the_app_is_closed.sql`.
- **Les tests de sécurité** : `supabase/tests/security_test.sql`, 2117
  lignes en 31 groupes, rejouables sur un PostgreSQL local (voir
  `supabase/tests/README.md`). **Le nombre exact de vérifications n'est
  pas fiable dans les documents** : `README.md` et
  `supabase/tests/README.md` annoncent 153, le fichier porte 50 lignes
  `raise notice 'OK'`, et l'ancien fichier de reprise citait 74, 114 et
  153 en trois endroits. Ce chiffre ne se recopie plus : il se relit
  dans la sortie du script — qu'aucune session ne peut produire d'ici,
  faute de PostgreSQL.
- **Base vide, et c'est l'état voulu** : le jeu de démonstration a été
  supprimé pour tester avec de vraies données. `supabase/seed_demo.sql`
  reste dans le dépôt pour le rejouer — ses lignes de photos ne
  désignent aucun fichier réel.

### Front-end — Next.js 16, React 19, TypeScript, Tailwind 4

- **40 pages** (`page.tsx`) et **3 gestionnaires de route** :
  `/auth/confirm`, `/api/notifications`, `/api/push/abonnement`.
- **57 composants** dans `src/components/` — `ui/` sans métier, puis
  `product/`, `chat/`, `auth/`.
- `src/lib/supabase/` — **un client par requête** : `server.ts`,
  `client.ts`, `middleware.ts`. Un client global serait une faille :
  deux visiteurs partageraient la même session.
- `src/lib/data/` — **lecture seule**, seul endroit qui connaît la forme
  de la base, traduit vers `src/lib/types.ts`.
- `src/lib/actions/` — **écriture** : `auth`, `merchants`, `products`,
  `messages`, `account`, `push`.
- `src/lib/mock.ts` — **ne sert plus que `/styleguide`** et la liste
  fixe des motifs de signalement. Plus aucun écran ne lit de fausses
  données.

### Fonctionnalités entières

- **Authentification** : inscription client et commerçant, connexion,
  déconnexion, mot de passe oublié, réinitialisation, comptes liés.
- **Toute l'application branchée sur la vraie base**, en lecture ET en
  écriture : catalogue, espace vendeur, messagerie, compte, suppression
  de compte.
- **Compression des photos dans le navigateur** (`PhotoPicker`), dans un
  worker pour ne pas geler un téléphone d'entrée de gamme, envoi direct
  vers Storage.
- **Recherche avec filtres par-dessus les résultats** (`FilterChip`, en
  `<details>`, sans JavaScript) et **recherches récentes**
  (`RecentSearches`). *Ces deux points étaient encore listés « à faire »
  dans l'ancien fichier : ils sont montés et vivants dans
  `(client)/(onglets)/recherche/page.tsx`.*
- **Bandeau de réseau dégradé** (`OfflineBanner`), posé dans le layout
  racine — une coupure ne choisit pas sa page. *Également listé « à
  faire » à tort.*
- **Conditions d'utilisation** : 25 articles dans
  `src/content/conditions.ts`, hors du JSX pour se relire sans le
  traverser, affichés par `/conditions` et `/vendeur/conditions`.
- **Notifications push** de bout en bout (`public/sw.js`,
  `src/lib/push.ts`, `0023`), avec l'interrupteur, l'invitation
  (`PushInvite`) et la séquence d'abonnement partagée
  (`usePushAbonnement`) — deux commandes du même abonnement ne peuvent
  pas diverger si elles lisent le même code. **Un refus et une
  suspension ne s'annoncent PAS en clair sur un écran verrouillé** : le
  push dit qu'une décision attend, l'email dit laquelle. Une validation,
  elle, s'annonce en clair : c'est une bonne nouvelle. Le service worker
  **ne met rien en cache** : il ne sert qu'aux notifications.
- **Temps réel partiel** : `RealtimeThread` affiche un message reçu
  pendant qu'on lit le fil (`0014`). Ce qui ne bouge pas en direct : la
  liste `/messages` et le badge de la barre d'onglets, qui attendent une
  navigation. Assumé — une marketplace de mise en relation n'est pas une
  messagerie instantanée.

### Les formulaires sans JavaScript — moins avancés qu'on ne le croyait

Les champs texte et les actions produit fonctionnent sans script ; le
`Toggle` « prix négociable » non, et **`PhotoPicker` non plus — ce qui
rend la publication d'un produit impossible sans JavaScript**, puisque
`check_product_publishable` exige au moins une photo. Le geste central
du commerçant est donc JS-seul. **Sur un réseau guinéen instable, un
formulaire qui exige que le script soit chargé est un formulaire qui
échoue** — et c'est ici le formulaire dont dépend tout le catalogue.

### Déploiement et commandes

Vercel, `main` en production : **ce qu'on pousse sur `main` part en
ligne**. Il n'y a pas de préversion pour rattraper une erreur — d'où les
vérifications avant push, pas après (voir `CLAUDE.md`).

```bash
npm install && npm run dev     # nécessite .env.local — voir README
npm run typecheck && npm run build
npm run classes                # classes Tailwind fantômes
npm run espaces                # étanchéité des deux espaces
npm run gardes                 # gardes de route
npm run poids                  # budgets de poids (docs/PERFORMANCE.md)
npm run parcours               # mesure d'un parcours
npm run tests                  # couche applicative (node --test, sans dépendance)
```

---

## 4. Décisions prises — ne pas les rediscuter

`docs/SPEC.md` fait foi ; ce qui suit est le rappel de ce qu'une session
suivante ne doit pas rouvrir.

- **Catalogue ouvert sans compte** ; compte exigé uniquement pour
  écrire.
- **Un seul fil par couple (client, boutique)** ; le premier message
  d'un fil cite obligatoirement un produit.
- **Deux comptes liés derrière une seule connexion**, avec bascule sans
  se reconnecter, et **jamais les deux mélangés sur un même écran** : à
  tout instant, un seul contexte est actif — barre d'onglets, écran
  d'ouverture et « Mon compte » compris.
- **Validation manuelle des boutiques par un APPEL téléphonique**, depuis
  le tableau de bord Supabase. Aucune page d'administration en v1. Ça ne
  passe pas à l'échelle, et c'est voulu tant qu'on vise la densité avant
  le volume.
- **Dix catégories**, sur un seul niveau, sans « Autre ».
- **Publication immédiate des produits**, avec bouton « signaler » et
  masquage par l'administrateur.
- **Disponibilité binaire** : disponible ou vendu, pas de stock.
- **Filtre de ville manuel**, jamais automatique.
- **La suspension coupe l'écriture, jamais la lecture**, et **dans les
  deux sens** (`0017`, `0022`) : on ne communique pas avec un compte
  suspendu, qu'il soit client ou boutique. Les fils restent entièrement
  lisibles. Un refus de validation n'est PAS une suspension : il retire
  du catalogue sans geler les fils.
- **On ne contacte pas sa propre boutique** — sans quoi le compteur de
  contacts, qui sert au tri « populaires », se remplit tout seul.
- **L'intention survit à l'authentification.** Le seul écran qui exige un
  compte est « Contacter le vendeur » ; qui s'y inscrit revient sur CE
  produit. `?next=` porte cette intention et `safeNextPath` est le seul
  endroit qui décide s'il est sûr.
- **L'email de refus d'une boutique invite à répondre** (`0021`) : la
  boîte de `EMAIL_FROM` doit donc être relevée par un humain. Un refus
  qui appelle une réponse sans canal pour la recevoir serait une
  impasse ; le canal est cette boîte.
- **Pas de notation**, **aucune monétisation en v1**.
- Direction visuelle **« A — Marché »** : fond papier chaud, accent terre
  cuite, bordures plutôt qu'ombres.

### Règles de travail

- **`main` est la branche unique**, de travail ET de production. La règle
  complète, et pourquoi elle a remplacé celle du 2026-09-16, est dans
  `CLAUDE.md` — c'est elle qui fait foi.
- **Une migration ne se réécrit jamais après avoir été appliquée** : elle
  décrit un pas déjà franchi, pas l'état final.
- **Toute migration appliquée au tableau de bord est commitée dans la
  même session**, et réciproquement. Les deux sens produisent le même
  écart : un dépôt qui décrit une base qui n'existe pas, ou plus.
- **Relancer les tests de sécurité après TOUTE modification de
  policy.** C'est
  ainsi que trois failles ont été trouvées, et aucune ne produisait
  d'erreur.

---

## 5. Pièges rencontrés — à ne pas refaire

La section la plus utile du fichier. Chaque ligne a coûté du temps.

### Sécurité et SQL

- **Révoquer un privilège sur une colonne ne sert à rien** si `UPDATE`
  existe au niveau de la table — ce que Supabase accorde par défaut. Il
  faut révoquer la table entière puis ré-accorder colonne par colonne.
  C'est ce qui permettait à un commerçant de s'auto-valider.
- **Le RLS filtre des lignes, jamais des colonnes.** Les deux questions
  se posent séparément à chaque table. C'est ce qui permettait à un
  participant de réécrire le message de son interlocuteur.
- **Le RLS ne se teste pas avec un outil qui le contourne.** Un défaut de
  la policy du catalogue restait invisible tant qu'il était testé via un
  accès administrateur. Trouvé en rejouant les requêtes en
  `set role anon`, comme un vrai visiteur.
- **Un avertissement de sécurité se vérifie, il ne se croit pas — dans
  les deux sens.** Sur onze fonctions signalées par l'audit Supabase,
  sept étaient de faux positifs et une était une vraie fuite. Ni « tout
  corriger » ni « tout ignorer » n'aurait donné le bon résultat.
- **Un identifiant difficile à deviner n'est pas une protection.** La
  première version de `conversation_is_open` (`0017`) tenait pour acquis
  qu'un identifiant de conversation n'est connu que de ses deux
  participants : un troisième compte obtenait quand même sa réponse en
  appelant la fonction avec cet identifiant. Un identifiant circule dans
  les URL, les journaux, les liens partagés et les captures d'écran.
  **Toute fonction `security definer` doit vérifier QUI demande, pas
  seulement CE QU'on lui demande** — la leçon avait déjà été tirée sur
  `is_active_profile` (`0005`) et n'a pas été appliquée du premier coup
  à la suivante.
- **Un confort administratif est le moment exact où l'on rouvre une
  faille.** En simplifiant la validation d'une boutique (`0012`), passer
  les fonctions en `security definer` les aurait rendues appelables en
  RPC par n'importe quel visiteur, c'est-à-dire l'auto-validation d'un
  commerçant. `security invoker` est écrit en clair pour que ce soit un
  choix visible, pas un défaut subi.
- **Quand un modèle de données change, les protections écrites pour
  l'ancien deviennent souvent décoratives** sans qu'aucun test ne le
  signale. Arrivé au quota anti-spam lors du passage au fil unique, puis
  au fichier de test lui-même lors du passage aux comptes liés.
- **Une règle métier posée sur la table A ne voit pas les écritures sur
  la table B.** `products_check_publishable` interdisait de publier un
  produit sans photo, mais rien ne se déclenchait quand les photos
  partaient par `product_images` — le chemin réel du code. **Une
  protection se vérifie sur le chemin réel, pas sur celui qu'on avait en
  tête en l'écrivant.**
- **Une migration appliquée au tableau de bord n'existe nulle part tant
  qu'elle n'est pas commitée.** Cinq migrations et une décision
  d'architecture entière ont vécu uniquement dans
  `supabase_migrations.schema_migrations`, invisibles depuis Git.

### Couche applicative

- **Une liste blanche qui compare des préfixes valide une ORTHOGRAPHE,
  pas une adresse.** `safeNextPath` refusait `//autre.gn` en testant le
  début de la chaîne ; une tabulation en deuxième position
  (`/<TAB>/faux-makiti.gn`) passait le filtre, et les navigateurs
  effacent les tabulations AVANT d'analyser l'adresse, qui redevient
  `//faux-makiti.gn`. **Une adresse se valide en l'analysant comme le
  fera celui qui la suivra** : caractères de contrôle refusés, puis
  résolution contre une origine qui n'existe pas, et l'origine doit être
  inchangée.
- **« Pas d'erreur » ne veut pas dire « c'est fait » — mais pas pour
  toutes les écritures.** Quand le RLS écarte une ligne, PostgREST
  renvoie un SUCCÈS portant zéro ligne : seul un `.select("id")` sur
  l'écriture dit ce qui a changé. **Cela vaut pour `update` et `delete`,
  dont le `using` filtre des LIGNES ; un `insert` refusé, lui, lève bien
  une erreur.** La version trop large de cette leçon a fait « corriger »
  deux `insert` qui allaient bien pendant que cinq `update`/`delete`
  restaient exposés — **une leçon formulée trop largement coûte autant
  qu'une leçon fausse : elle fait corriger les mauvais endroits avec la
  bonne conscience d'un travail fini.**
- **Une action dont on ne peut pas savoir si elle a réussi est une action
  cassée, même quand elle fonctionne.** Vécu dans les deux sens le même
  jour : l'éditeur de table Supabase changeait un statut sans rien
  confirmer (l'écriture a été crue refusée), et six actions de
  l'application faisaient l'inverse.
- **`auth.getUser()` est un aller-retour réseau, pas une lecture de
  cookie.** Corrigé en mettant `getSessionUser`, `getMyProfiles` ET
  `createClient` en cache par requête : sans le dernier, deux appels à
  `createClient()` produisent deux clients différents, donc deux clés de
  cache, et le reste ne sert à rien.
- **Une règle posée dans la base doit être demandée à la base, et jamais
  sans session.** `getThreadContext` interroge `conversation_is_open`
  pour savoir s'il faut afficher le champ de saisie — mais `execute` est
  révoquée à `anon`, donc un lien de conversation partagé et ouvert sans
  session affichait « Vérifiez votre connexion », une panne réseau
  imaginaire.
- **Une classe Tailwind qui n'existe pas ne produit aucune erreur.** Un
  token oublié fait disparaître un style en silence. D'où
  `npm run classes`.
- **Un paramètre qui rattrape une différence de structure est le signe
  qu'il en faut deux.** `BottomNav` servait les deux espaces avec une
  liste unique plus un `accountHref` pour corriger le dernier onglet : le
  correctif n'était pas un meilleur paramètre, c'étaient deux listes.
- **Un correctif peut créer un défaut ailleurs.** Router un commerçant
  vers `/vendeur` a rendu son onglet « Accueil » MORT : on le touchait,
  on revenait au même écran. Un onglet qui ne fait rien est pire qu'un
  onglet absent — on réessaie, et on croit l'application bloquée.
- **Un squelette de chargement qui ne ressemble pas à la vraie page fait
  sauter la page**, et **un `loading.tsx` placé dans un dossier prend le
  pas sur celui du parent**.
- **Un identifiant de démonstration survit à la donnée de
  démonstration.** Neuf liens de `/ecrans` pointaient encore sur `p-riz`
  ou `m-aissatou` alors que la base crée des UUID — morts depuis le
  branchement, invisibles parce que personne n'avait ouvert la page.
- **`Intl.NumberFormat` en français** sépare les milliers par une espace
  fine insécable, illisible sur mobile. Remplacée par une espace
  insécable ordinaire dans `src/lib/format.ts`.

### Supabase Auth

- **`signOut()` sans argument est GLOBAL** : il révoque TOUS les jetons de
  l'utilisateur, sur tous ses appareils. `verify.ts` le faisait après
  avoir vérifié un mot de passe — avec un client pourtant « jetable » —
  et déconnectait donc la personne à chaque enregistrement. Le bug a vécu
  trois jours ; aucun test, aucun type, aucun build ne pouvait
  l'attraper.
- **La leçon générale** : un client Supabase « isolé » ne l'est que pour
  ce qu'il STOCKE. Tout ce qu'il demande au serveur porte sur le compte
  entier. **L'isolation locale ne dit rien de la portée distante.**
- **Le client anonyme ne sait pas révoquer UNE session.** Un jeton obtenu
  pour vérifier un mot de passe vit donc jusqu'à son expiration : c'est
  le prix, et il est bien moindre que déconnecter quelqu'un.

### Méthode

- **La vérification automatique et le fait de regarder ne trouvent pas
  les mêmes défauts, et aucune ne remplace l'autre.** C'est la leçon la
  plus rentable du projet. Tout avait été vérifié autrement — requêtes
  rejouées en anonyme réel, migrations rejouées sur un PostgreSQL vierge,
  tests de sécurité, build de production. **Le premier vrai passage sur
  téléphone a trouvé quatre défauts en quelques minutes.**
- **Une décision écrite en plusieurs clauses se vérifie clause par
  clause.** « Ni la même barre d'onglets, ni le même écran d'ouverture,
  ni le même Mon compte » : une seule clause a été traitée, et le travail
  a été annoncé comme terminé.
- **Un document écrit au passé avant que le code ne suive ment pendant
  des jours sans que personne ne le voie.** Arrivé à la règle R4 de
  `PERFORMANCE.md`, qui s'est décrite appliquée six jours avant de
  l'être, et qui raconte elle-même l'épisode. **Un document qui décrit
  une intention s'écrit au futur ; le passé attend le commit.**
- **Une branche locale périmée fabrique de faux défauts, et ils ont
  l'air vrais.** Le 2026-09-21, la réécriture de ce fichier a d'abord
  été faite sur un `main` LOCAL vieux de 21 commits : R4 y semblait
  démentie par `layout.tsx`, `npm run poids` y sortait en erreur sur
  deux budgets, et ces deux « découvertes » ont été mesurées, chiffrées
  et écrites avant que le `push` ne les démente. Le commit qui les
  effaçait — « Une seule police » — existait depuis la veille.
  `git branch --show-current` répond à la mauvaise question : il dit le
  NOM de la branche, jamais si elle est à jour. **`git fetch` puis
  `git status` AVANT la première lecture, pas avant le push** — à ce
  moment-là, le travail est déjà fait contre le mauvais arbre.
- **Un plan dont les quatre cinquièmes racontent le passé ne se lit
  plus.** Arrivé deux fois à ce fichier même. Le journal est parti dans
  Git le 2026-09-21 ; s'il revient, c'est que le fichier est en train de
  mourir une troisième fois.
- **Un formulaire qui accepte puis oublie est pire qu'un bouton mort : il
  ment.** La v1 du projet a annoncé « toutes les actions branchées » alors
  que rien n'était enregistré. **Tant qu'une action n'a pas d'effet
  visible à l'écran suivant, elle n'est pas faite.**
- **Un test qui vérifie une redirection ne vérifie rien.** Les 19
  vérifications de la v1 passaient toutes : elles regardaient où l'on
  ATTERRIT, jamais ce que l'écran d'après MONTRE.
- **Un service worker mal retiré SURVIT à son application.** Le jour où le
  chantier de mise en cache (R6 de `PERFORMANCE.md`) commencera, prévoir
  dès le premier jour comment le désinstaller — sinon des téléphones
  resteront servis par une version morte de Makiti, sans aucun moyen de
  les rattraper.

---

## 6. Où lire le reste

- `CLAUDE.md` — la règle Git, et la forme attendue des comptes rendus.
- `docs/SPEC.md` — les décisions produit, qui font foi.
- `docs/ECRANS.md` — les 36 écrans, un par ligne, avec leur route.
- `docs/ARCHITECTURE.md` — les espaces, les groupes de routes, les
  gardes.
- `docs/PERFORMANCE.md` — les budgets et les règles R1 à R7.
- `supabase/tests/README.md` — comment rejouer les tests de sécurité.

---

## 7. Le vrai risque

Le code est presque fait ; ce n'est pas là que le projet se joue.

Une marketplace vide n'attire aucun client, et sans clients aucun
commerçant ne reste. **Recruter les vingt premiers commerçants — sur un
seul marché, la densité battant le volume — est le travail le plus
difficile du projet, et il ne s'écrit pas en TypeScript.**
