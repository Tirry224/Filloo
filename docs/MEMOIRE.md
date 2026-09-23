# Mémoire de Makiti

Point d'entrée pour reprendre le projet dans une nouvelle conversation.
Il remplace `docs/REPRISE.md` depuis le **2026-09-23**.

Le fichier a deux parties, écrites de deux façons différentes :

- **Tout ce qui précède « Évolution, commit par commit » est écrit à la
  main** : ce qui reste, ce qui est fait, ce qui est tranché, ce qui a
  déjà fait mal — c'est-à-dire ce que Git ne sait pas dire.
- **« Évolution, commit par commit » est généré par `npm run memoire`**
  à partir de `git log`, et ne s'édite jamais à la main. L'ancien fichier
  de reprise est mort deux fois d'un journal recopié de Git qui
  vieillissait sans être relu : un historique produit par la machine ne
  peut pas mentir sur ce qu'elle contient.

**À chaque commit :** lancer `npm run memoire`, et mettre à jour à la main
les sections concernées si le commit ferme un point, en ouvre un ou
enseigne quelque chose. Un commit ne peut pas citer sa propre empreinte :
la liste générée s'arrête au commit précédent, et le suivant la rattrape.

**Citer ce fichier par le TITRE d'une section, jamais par un numéro.**
Les numéros de l'ancien fichier désignaient un plan disparu depuis
plusieurs réécritures, et une vingtaine de commentaires de code les
citaient encore.

**Les migrations citent encore `docs/REPRISE.md`**, souvent par un
numéro d'étape. Elles ne se corrigent pas — une migration appliquée ne se
réécrit pas, même pour un commentaire. Pour relire ce qu'elles citaient :
`git log --follow -- docs/REPRISE.md` donne les versions de l'ancien
fichier, et `git show <empreinte>:docs/REPRISE.md` en affiche une, à la
date de la migration.

**État en une phrase :** l'application est complète, branchée sur la
vraie base et en ligne ; ce qui la sépare d'un vrai commerçant n'est plus
du code mais une chaîne d'emails à réparer et trois parcours à faire sur
un téléphone.

**Ce qu'une session peut vérifier, et ce qu'elle ne peut pas.** Tout ce
qui porte sur le dépôt se relit dans le code. Tout ce qui porte sur la
production (Vercel, Supabase, une boîte email) est invérifiable depuis
une session : pas d'accès aux variables Vercel (403), `*.supabase.co`
injoignable. Ces points sont marqués **« à constater »** — ni faits ni
cassés.

---

## Ce qui reste à faire

### Bloquant pour ouvrir à un vrai commerçant

- **L'INSCRIPTION EST CASSÉE EN PRODUCTION** (constaté le 2026-09-23).
  Une inscription depuis l'application renvoie « Error sending
  confirmation email » et aucun compte n'est créé : la confirmation
  d'email a été activée côté Supabase AVANT que le SMTP soit prouvé,
  exactement ce que la ligne « Activer la confirmation d'email » plus bas
  interdisait. Les trois comptes existants datent d'avant (confirmés
  automatiquement les 15 et 16 septembre). Décocher la confirmation, ou
  brancher un vrai SMTP.
- **Aucun push n'a jamais été distribué.** Le 2026-09-23,
  `push_subscriptions.last_used_at` était vide sur les quatre abonnements,
  alors que des messages étaient arrivés après leur création. Premier
  suspect : `VAPID_PRIVATE_KEY` absente de Vercel, ou d'une autre paire que
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Les abandons de `notifyNewMessage` sont
  désormais journalisés (`[notification]`, `[push]`) : les journaux Vercel
  diront lequel. *À constater.*
- **La chaîne d'envoi d'emails est CASSÉE.** Le 2026-09-21, la file
  `notifications` de production portait une ligne `merchant_approved`
  créée le 17 et jamais envoyée : le cron quotidien de 7 h avait échoué
  quatre fois, et un commerçant validé n'a jamais appris qu'il l'était.
  Personne n'a encore vu un email arriver dans une vraie boîte.
- **`CRON_SECRET` sur Vercel.** Sans elle, `/api/notifications` refuse
  tout et aucune décision d'administration n'est annoncée. Premier
  suspect de la panne ci-dessus. *À constater.*
- **`NEXT_PUBLIC_SITE_URL` sur Vercel.** Depuis le 2026-09-22,
  `src/lib/site-url.ts` se rabat sur `VERCEL_PROJECT_PRODUCTION_URL`
  quand elle manque, donc son absence ne devrait plus éteindre les emails
  — mais c'est le filet, pas l'adresse voulue. *À constater.*
- **Activer la confirmation d'email côté Supabase.** Décidée (SPEC,
  décision 1), gérée de bout en bout par le code (`needsConfirmation`,
  message d'attente dans `SignupForm`, `emailRedirectTo`). C'est une case
  à cocher — **et elle ne se coche qu'après le SMTP prouvé**, sinon plus
  personne ne peut s'inscrire.

### À faire sur un vrai téléphone, par toi

Les sessions ne joignent ni `*.supabase.co` ni `*.vercel.app` et ne
peuvent pas lancer de pile Supabase locale : elles ne voient **jamais un
écran portant de vraies données**. Ces trois parcours n'ont jamais été
vus fonctionner par personne :

- la **messagerie entre deux comptes réels** ;
- l'**envoi d'une photo depuis un téléphone** ;
- le **parcours de refus d'une boutique**.

`/ecrans` (en local uniquement) liste les écrans et allume chaque lien dès
que l'enregistrement correspondant existe. **Noter les défauts au fil de
l'eau plutôt que les corriger un par un** : corriger en cours de parcours
fait perdre le fil du parcours.

### Gestes de ménage, non bloquants

- **Supprimer `/ecrans` et `/styleguide`** une fois le parcours
  ci-dessus terminé : une page de travail qu'on oublie finit par être
  trouvée.
- **Regarder le projet Supabase « Fillo »** du 2026-08-25, qui tourne
  encore à côté de `Makiti` sans qu'on sache s'il sert.
- **Supprimer les branches `claude/*` restées sur GitHub.** Inventoriées
  le 2026-09-21 : aucune ne portait alors de contenu absent de `main`. Le
  relais Git des sessions refuse la suppression de références (403) :
  **à faire depuis une machine où `git` parle directement à GitHub**, et
  jamais sans l'accord du porteur du projet (règle de `CLAUDE.md`).

### Une observation de terrain, pas un bug

**Le parcours vers le compte lié ne se trouve pas tout seul.** Le porteur
du projet lui-même a créé DEUX CONNEXIONS au lieu d'un second profil lié :
l'écran d'inscription ne propose le compte lié qu'à une personne DÉJÀ
connectée, ce qui n'est pas le réflexe de quelqu'un qui veut « aussi
vendre ». Si celui qui a conçu le produit se trompe, l'utilisateur se
trompera.

### Dettes techniques connues, aucune bloquante

- **`npm run tests` ne trouve aucun fichier sous Windows** : les
  guillemets simples de `'tests/*.test.ts'` ne sont pas retirés par
  `cmd.exe`, et le script affiche « pass 0 » sans échouer.
  `node --experimental-strip-types --test tests/*.test.ts` depuis Git Bash
  les lance (33 au 2026-09-23).
- **La couche applicative est à peine testée.** `npm run tests` couvre
  `safeNextPath`, les règles de saisie et l'adresse du site ; les actions
  serveur, là où vivent les écritures, n'ont aucun test. Deux mille lignes
  de tests couvrent le SQL, alors que TOUS les bugs de terrain ont été
  trouvés dans la couche applicative : la couche la mieux testée n'est
  pas celle qui casse.
- **Le dépôt et la production ne portent pas les mêmes commentaires
  SQL.** Le mécanisme d'application les retire ; la logique est
  identique. À traiter en corrigeant le mécanisme, **jamais en réécrivant
  une migration appliquée**. Conséquence : comparer les empreintes
  `md5(pg_get_functiondef())` entre local et production donne des faux
  positifs sur toute fonction commentée.
- **Le commentaire de la migration `0023` est faux** — le rectificatif
  vit ici, parce qu'une migration appliquée ne se réécrit pas.
- **Sept blocs `exception when others` dans `security_test.sql`.** Celui
  du quota des 100 messages/jour affiche `OK` sans vérifier le
  `sqlstate` : un refus RLS ou une faute de frappe produiraient le même
  vert. Celui du quota de conversations exige `P0001` ; les deux
  devraient se ressembler.
- **`middleware` est déprécié en Next 16** :
  `npx @next/codemod@canary middleware-to-proxy .`. Le faire débloquerait
  aussi un vrai 404 sur `/ecrans`, aujourd'hui un 200 qui porte la page
  « n'existe pas ».
- **Modifier sa boutique ne relance PAS la vérification, contrairement
  à la maquette.** `updateMerchantAction` ne touche jamais `status`, sinon
  les produits en ligne disparaîtraient du catalogue. C'est un choix du
  code, que le porteur du projet n'a pas tranché : un commerçant validé
  peut donc renommer sa boutique sans nouvel appel.
- **`/inscription/boutique` hérite du squelette de chargement client** et
  affiche brièvement « Conakry » pendant l'inscription commerçant.

---

## Ce que Makiti est

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

## Ce qui est fait

Les chiffres datés ont été comptés à cette date ; ils se recomptent, ils
ne se recopient pas.

### Base de données — écrite, testée, déployée

- **25 migrations** dans `supabase/migrations/` au 2026-09-23, de
  `0001_schema.sql` à `0025_a_catalogue_without_a_catch_all.sql`.
- **Les tests de sécurité** : `supabase/tests/security_test.sql`,
  rejouables sur un PostgreSQL local (voir `supabase/tests/README.md`).
  Le 2026-09-22 : **158 vérifications, toutes au vert** sur 24
  migrations. Le nombre se relit dans la sortie du script, jamais dans un
  document.
- **Base vide, et c'est l'état voulu** : le jeu de démonstration a été
  supprimé pour tester avec de vraies données. `supabase/seed_demo.sql`
  reste pour le rejouer — ses lignes de photos ne désignent aucun fichier
  réel.

### Front-end — Next.js 16, React 19, TypeScript, Tailwind 4

- **44 pages** (`page.tsx`) et **63 composants** au 2026-09-23 ;
  `src/components/ui/` est sans métier.
- `src/lib/supabase/` — **un client par requête** : un client global
  serait une faille, deux visiteurs partageraient la même session.
  `public.ts` est un client ANONYME, utilisé par le plan du site.
- `src/lib/data/` — **lecture seule**, seul endroit qui connaît la forme
  de la base, traduite vers `src/lib/types.ts`.
- `src/lib/actions/` — **écriture** : `auth`, `merchants`, `products`,
  `messages`, `account`, `push`.
- `src/lib/mock.ts` — **ne sert plus que `/styleguide`** et la liste
  fixe des motifs de signalement.

### Fonctionnalités entières

- **Authentification** : inscription client et commerçant, connexion,
  mot de passe oublié avec `?next=` conservé sur tout le parcours,
  comptes liés.
- **Toute l'application branchée sur la vraie base**, en lecture ET en
  écriture : catalogue, espace vendeur, messagerie, compte, suppression
  de compte (anonymisation, jamais un vrai `DELETE`).
- **Compression des photos dans le navigateur** (`PhotoPicker`), dans un
  worker pour ne pas geler un téléphone d'entrée de gamme.
- **Recherche avec filtres** (`FilterChip`, en `<details>` natif) et
  **recherches récentes**.
- **Bandeau de réseau dégradé** (`OfflineBanner`), dans le layout racine.
- **Conditions d'utilisation** (`src/content/conditions.ts`),
  **Politique de confidentialité** (`src/content/confidentialite.ts`,
  responsable nommé) et **écran de contact** — les promesses des articles
  19 et 24, tenues. L'inscription nomme les conditions sous son bouton.
- **Le partage** : `generateMetadata` sur la fiche produit et la fiche
  boutique. **Pas à la racine** : mesuré, cela coûtait 0,2 Ko sur CHAQUE
  écran et faisait sortir `/conditions` de son budget ; payer partout ce
  qui ne sert qu'à deux écrans était le mauvais calcul.
- **`sitemap.ts` et `robots.ts`**, construits avec le client anonyme :
  c'est le RLS qui décide de la liste, donc aucune condition n'est écrite
  deux fois.
- **Compteurs d'usage** (`0024`, `src/lib/analytics.ts`) : mesurés côté
  SERVEUR, zéro octet de JavaScript, aucune donnée identifiante. La table
  refuse `anon` et `authenticated` des deux côtés (RLS sans policy ET
  privilèges révoqués), vérifié en `set role anon`.
- **Notifications push** de bout en bout (`public/sw.js`,
  `src/lib/push.ts`, `0023`). **Un refus et une suspension ne
  s'annoncent PAS en clair sur un écran verrouillé** : le push dit qu'une
  décision attend, l'email dit laquelle. Le service worker **ne met rien
  en cache**.
- **Temps réel** : `RealtimeThread` affiche un message reçu pendant
  qu'on lit le fil, et `RealtimeUnread` (dans les deux layouts d'onglets)
  rafraîchit badge, liste et tableau de bord à l'arrivée d'un message ou au
  retour au premier plan. Le layout d'onglets n'est pas re-rendu par Next
  d'un onglet à l'autre : sans lui, le compteur restait figé.
- **Installation de l'application** proposée à l'entrée, et **mise en
  page tenue sur grand écran**.

### JavaScript : alléger reste une règle, s'en passer n'en est plus une

L'exigence « tout écran doit marcher sans JavaScript » a été retirée par
le porteur du projet le 2026-09-22 : une compression d'image ne s'écrit
pas sans script, et un produit sans photo n'est pas publiable. Ce qui
demeure : socle JavaScript plafonné à 200 Ko, liens de liste sans
préchargement, filtres en `<details>` natif, et le serveur revalide
toujours tout (voir `docs/PERFORMANCE.md`).

### Déploiement et commandes

Vercel, `main` en production : **ce qu'on pousse sur `main` part en
ligne**, d'où les vérifications avant push (voir `CLAUDE.md`).

```bash
npm install && npm run dev     # nécessite .env.local — voir README
npm run typecheck && npm run build
npm run classes                # classes Tailwind fantômes
npm run espaces                # étanchéité des deux espaces
npm run gardes                 # gardes de route
npm run poids                  # budgets de poids (docs/PERFORMANCE.md)
npm run parcours               # mesure d'un parcours
npm run tests                  # couche applicative (node --test, sans dépendance)
npm run memoire                # régénère l'historique de ce fichier
```

---

## Décisions prises — ne pas les rediscuter

`docs/SPEC.md` fait foi ; ce qui suit est le rappel de ce qu'une session
suivante ne doit pas rouvrir.

- **Catalogue ouvert sans compte** ; compte exigé uniquement pour
  écrire.
- **Un seul fil par couple (client, boutique)** ; le premier message
  d'un fil cite obligatoirement un produit.
- **Deux comptes liés derrière une seule connexion**, avec bascule sans
  se reconnecter, et **jamais les deux mélangés sur un même écran** :
  barre d'onglets, écran d'ouverture et « Mon compte » compris.
- **Validation manuelle des boutiques par un APPEL téléphonique**, depuis
  le tableau de bord Supabase. Aucune page d'administration en v1 : ça ne
  passe pas à l'échelle, et c'est voulu tant qu'on vise la densité avant
  le volume.
- **Neuf catégories** sur un seul niveau, sans « Autre » (`0025`), et
  **douze villes**. Mots et nombre arrêtés par le porteur du projet le
  2026-09-23 : rien ne bouge avant qu'un besoin réel, constaté chez un
  commerçant, ne le justifie.
- **Publication immédiate des produits**, avec bouton « signaler » et
  masquage par l'administrateur.
- **Disponibilité binaire** : disponible ou vendu, pas de stock.
- **Filtre de ville manuel**, jamais automatique.
- **La suspension coupe l'écriture, jamais la lecture**, et **dans les
  deux sens** (`0017`, `0022`). Un refus de validation n'est PAS une
  suspension : il retire du catalogue sans geler les fils.
- **Le blocage entre personnes est définitif en v1** : la policy
  n'autorise qu'à POSER `blocked_by`, aucun écran ne débloque, et l'écran
  le dit.
- **On ne contacte pas sa propre boutique** — sans quoi le compteur de
  contacts, qui sert au tri « populaires », se remplit tout seul.
- **L'intention survit à l'authentification.** Qui s'inscrit depuis
  « Contacter le vendeur » revient sur CE produit. `?next=` porte cette
  intention et `safeNextPath` est le seul endroit qui décide s'il est
  sûr.
- **L'email de refus d'une boutique porte un motif et invite à
  répondre** (`0012`, `0021`) : un refus sans motif est un vendeur perdu
  définitivement, et la boîte de `EMAIL_FROM` doit être relevée par un
  humain.
- **Pas de notation**, **aucune monétisation en v1**.
- Direction visuelle **« A — Marché »** : fond papier chaud, accent terre
  cuite, bordures plutôt qu'ombres.

### Règles de travail

- **`main` est la branche unique**, de travail ET de production. La règle
  complète est dans `CLAUDE.md` — c'est elle qui fait foi.
- **Une migration ne se réécrit jamais après avoir été appliquée** : elle
  décrit un pas déjà franchi, pas l'état final.
- **Toute migration appliquée au tableau de bord est commitée dans la
  même session**, et réciproquement.
- **Relancer les tests de sécurité après TOUTE modification de
  policy.** C'est ainsi que trois failles ont été trouvées, et aucune ne
  produisait d'erreur.

---

## Pièges rencontrés — à ne pas refaire

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
  sept étaient de faux positifs et une était une vraie fuite.
- **Un identifiant difficile à deviner n'est pas une protection.** La
  première version de `conversation_is_open` (`0017`) répondait à un
  troisième compte qui connaissait l'identifiant. Un identifiant circule
  dans les URL, les journaux et les captures d'écran. **Toute fonction
  `security definer` doit vérifier QUI demande, pas seulement CE QU'on
  lui demande.**
- **Un confort administratif est le moment exact où l'on rouvre une
  faille.** Passer les fonctions de validation (`0012`) en
  `security definer` les aurait rendues appelables en RPC par n'importe
  quel visiteur. `security invoker` est écrit en clair pour que ce soit
  un choix visible.
- **Quand un modèle de données change, les protections écrites pour
  l'ancien deviennent souvent décoratives** sans qu'aucun test ne le
  signale. Arrivé au quota anti-spam lors du passage au fil unique, puis
  au fichier de test lui-même lors du passage aux comptes liés.
- **Une règle métier posée sur la table A ne voit pas les écritures sur
  la table B.** `products_check_publishable` ne se déclenchait pas quand
  les photos partaient par `product_images` — le chemin réel du code.
  **Une protection se vérifie sur le chemin réel.**
- **Une migration appliquée au tableau de bord n'existe nulle part tant
  qu'elle n'est pas commitée.** Cinq migrations et une décision
  d'architecture entière ont vécu uniquement dans
  `supabase_migrations.schema_migrations`.

### Couche applicative

- **Une liste blanche qui compare des préfixes valide une ORTHOGRAPHE,
  pas une adresse.** `/<TAB>/faux-makiti.gn` passait `safeNextPath`, et
  les navigateurs effacent les tabulations avant d'analyser l'adresse.
  **Une adresse se valide en l'analysant comme le fera celui qui la
  suivra.**
- **« Pas d'erreur » ne veut pas dire « c'est fait » — pour `update` et
  `delete`.** Quand le RLS écarte une ligne, PostgREST renvoie un SUCCÈS
  portant zéro ligne : seul un `.select("id")` dit ce qui a changé. Un
  `insert` refusé, lui, lève bien une erreur. **Une leçon formulée trop
  largement fait corriger les mauvais endroits avec la bonne conscience
  d'un travail fini.**
- **Une action dont on ne peut pas savoir si elle a réussi est une action
  cassée, même quand elle fonctionne.**
- **`auth.getUser()` est un aller-retour réseau, pas une lecture de
  cookie.** D'où `getSessionUser`, `getMyProfiles` ET `createClient` en
  cache par requête — sans le dernier, deux clients différents font deux
  clés de cache. Même logique pour la messagerie : vingt fils ne doivent
  pas coûter vingt requêtes.
- **Une règle posée dans la base doit être demandée à la base, et jamais
  sans session.** `conversation_is_open` est révoquée à `anon` : un lien
  de conversation ouvert sans session affichait une panne réseau
  imaginaire.
- **Une classe Tailwind qui n'existe pas ne produit aucune erreur.** D'où
  `npm run classes`.
- **Un paramètre qui rattrape une différence de structure est le signe
  qu'il en faut deux.** `BottomNav` : le correctif n'était pas un
  meilleur paramètre, c'étaient deux listes.
- **Un correctif peut créer un défaut ailleurs.** Router un commerçant
  vers `/vendeur` a rendu son onglet « Accueil » MORT. Un onglet qui ne
  fait rien est pire qu'un onglet absent.
- **Un squelette de chargement qui ne ressemble pas à la vraie page fait
  sauter la page**, et **un `loading.tsx` placé dans un dossier prend le
  pas sur celui du parent**.
- **Un identifiant de démonstration survit à la donnée de
  démonstration.** Neuf liens de `/ecrans` pointaient encore sur des
  identifiants de démonstration morts.
- **`Intl.NumberFormat` en français** sépare les milliers par une espace
  fine insécable, illisible sur mobile. Remplacée dans
  `src/lib/format.ts`.
- **Un champ sans colonne réelle ne s'invente pas.** La maquette
  affichait un motif de suspension que la base ne stocke pas : retiré
  plutôt que simulé.

### Supabase Auth

- **`signOut()` sans argument est GLOBAL** : il révoque TOUS les jetons de
  l'utilisateur, sur tous ses appareils. `verify.ts` déconnectait ainsi
  la personne à chaque enregistrement ; le bug a vécu trois jours, et
  aucun test, type ou build ne pouvait l'attraper.
- **Un client Supabase « isolé » ne l'est que pour ce qu'il STOCKE.** Tout
  ce qu'il demande au serveur porte sur le compte entier.
- **Le client anonyme ne sait pas révoquer UNE session.** Un jeton obtenu
  pour vérifier un mot de passe vit jusqu'à son expiration : c'est le
  prix, bien moindre que déconnecter quelqu'un.

### Méthode

- **La vérification automatique et le fait de regarder ne trouvent pas
  les mêmes défauts.** Tout avait été vérifié autrement ; **le premier
  vrai passage sur téléphone a trouvé quatre défauts en quelques
  minutes.**
- **Une décision écrite en plusieurs clauses se vérifie clause par
  clause.** Une seule clause traitée, et le travail annoncé terminé.
- **Un document écrit au passé avant que le code ne suive ment pendant
  des jours.** **Une intention s'écrit au futur ; le passé attend le
  commit.**
- **Une branche locale périmée fabrique de faux défauts, et ils ont
  l'air vrais.** `git branch --show-current` dit le NOM de la branche,
  jamais si elle est à jour. **`git fetch` puis `git status` AVANT la
  première lecture.**
- **Un clone partiel cache l'histoire.** Les sessions clonent les 50
  derniers commits : `git log` y paraît complet et ne l'est pas. D'où le
  refus de `npm run memoire` sur un clone partiel.
- **Un journal écrit à la main recopie Git et meurt.** L'ancien fichier
  de reprise y est passé deux fois (725 lignes de journal sur 1506). La
  mémoire écrite à la main garde le POURQUOI ; le QUOI est généré.
- **Un fichier de reprise qui ment sur ce qui est fait fait perdre le
  temps qu'il devait faire gagner.** Il annonçait encore, le 2026-09-23,
  un responsable de traitement vide alors qu'il était rempli.
- **Un formulaire qui accepte puis oublie est pire qu'un bouton mort : il
  ment.** Tant qu'une action n'a pas d'effet visible à l'écran suivant,
  elle n'est pas faite.
- **Un test qui vérifie une redirection ne vérifie rien** : il regarde où
  l'on ATTERRIT, jamais ce que l'écran d'après MONTRE.
- **Un service worker mal retiré SURVIT à son application.** Le jour où
  la mise en cache (R6 de `PERFORMANCE.md`) commencera, prévoir dès le
  premier jour comment la désinstaller.

---

## Où lire le reste

- `CLAUDE.md` — la règle Git, et la forme attendue des comptes rendus.
- `docs/SPEC.md` — les décisions produit, qui font foi.
- `docs/ECRANS.md` — les écrans, un par ligne, avec leur route.
- `docs/ARCHITECTURE.md` — les espaces, les groupes de routes, les
  gardes.
- `docs/PERFORMANCE.md` — les budgets et les règles R1 à R7.
- `supabase/tests/README.md` — comment rejouer les tests de sécurité.

---

## Le vrai risque

Le code est presque fait ; ce n'est pas là que le projet se joue.

Une marketplace vide n'attire aucun client, et sans clients aucun
commerçant ne reste. **Recruter les vingt premiers commerçants — sur un
seul marché, la densité battant le volume — est le travail le plus
difficile du projet, et il ne s'écrit pas en TypeScript.**

---

## Évolution, commit par commit

<!-- DEBUT HISTORIQUE — généré par `npm run memoire`, ne pas éditer à la main -->

160 commits, du plus récent au plus ancien.

### 2026-09-23

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
