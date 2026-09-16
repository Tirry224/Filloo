# Makiti

Marketplace de mise en relation entre commerçants et clients, en Guinée.
Le commerçant publie ses produits, le client les parcourt librement et le
contacte par messagerie interne. **Aucun paiement en ligne** : la vente se
conclut hors de l'application.

- **Reprendre le travail : [`docs/REPRISE.md`](docs/REPRISE.md)**
- Spécification complète : [`docs/SPEC.md`](docs/SPEC.md)
- Base de données : [`supabase/migrations/`](supabase/migrations/)

## État d'avancement

- [x] Spécification validée
- [x] Schéma de base de données, règles métier et sécurité (RLS)
- [x] Tests de sécurité (61 vérifications, voir `supabase/tests/`)
- [x] Budgets de performance mesurés (`npm run poids`, voir `docs/PERFORMANCE.md`)
- [x] Projet Supabase créé et migrations exécutées
- [x] Design system et bibliothèque de composants (`src/styles/`, `src/components/`)
- [x] Les 33 écrans
- [x] Branchement sur la vraie base, en lecture ET en écriture : catalogue
      public, espace vendeur, messagerie, compte et suppression de compte
- [x] Authentification (inscription, connexion, comptes liés)
- [x] Déploiement Vercel — `main` est la branche de production
- [ ] Parcours complet des écrans dans un navigateur (commencé le 12/09)
- [ ] Notification par email des nouveaux messages (le seul point
      bloquant pour un lancement)
- [ ] Conditions d'utilisation — la ligne existe, le texte manque

## Tests

Les règles de sécurité sont couvertes par des tests exécutables sur un
PostgreSQL local : voir [`supabase/tests/README.md`](supabase/tests/README.md).
À lancer après toute modification d'une policy.

## Démarrer l'application

```bash
npm install
npm run dev
```

**`/ecrans`** liste les 33 écrans avec un lien vers chacun, et dit ce
qu'il faut créer en base quand un lien a besoin d'un enregistrement qui
n'existe pas encore. C'est le point d'entrée pour tout relire.

Page de travail : **accessible en développement seulement**, introuvable
en production. À supprimer pour de bon quand le parcours complet des
écrans sera terminé.

Toute autre adresse affiche la page « Cette page n'existe pas ».
- **`/styleguide`** : tous les composants et tous les tokens sur une page.

`.env.local` est nécessaire pour démarrer (voir plus bas) : sans lui,
l'application s'arrête tout de suite avec un message explicite plutôt que
de laisser une erreur réseau incompréhensible apparaître plus tard.

**Toute l'application lit et écrit la vraie base** : catalogue public,
espace vendeur, messagerie, compte et suppression de compte. `mock.ts` ne
sert plus que la galerie `/styleguide` et la liste des motifs de
signalement.

**La base est vide** : le jeu de démonstration a été supprimé le
2026-09-12 pour tester avec de vraies données. Pour le remettre,
rejouer `supabase/seed_demo.sql` (deux boutiques, six produits) ; la
commande pour l'enlever à nouveau est à la fin du fichier.

Une boutique créée depuis l'application arrive en `pending` : la
validation est **manuelle**, depuis Supabase, et il n'y a pas de page
d'administration en v1. Changer la seule cellule `merchants.status`
suffit — voir `supabase/migrations/0012_...sql`.

Pour changer l'apparence de l'application, voir
[`src/styles/README.md`](src/styles/README.md).

## Mise en place de la base

1. Créer un projet sur [supabase.com](https://supabase.com) (offre gratuite),
   région Europe de l'Ouest — la plus proche de la Guinée.
2. Dans **SQL Editor**, exécuter les fichiers de `supabase/migrations/`
   **dans l'ordre numérique**, un par un. Lire les commentaires en même
   temps : ils expliquent chaque décision.
3. Dans **Authentication → Providers**, garder `Email` activé et désactiver
   la confirmation par email pendant le développement.
4. Vérifier dans **Database → Tables** que chaque table affiche bien
   « RLS enabled ». Si une seule ne l'est pas, ses données sont publiques.

## Variables d'environnement

À placer dans `.env.local`, **jamais** dans un fichier versionné :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

La clé `anon` est conçue pour être exposée au navigateur : c'est le RLS qui
protège les données, pas le secret de cette clé. En revanche la clé
`service_role` ignore complètement le RLS et donne un accès total à la base.
Elle ne doit jamais apparaître dans le code du navigateur, ni dans Git.

### Notifications par email (Resend)

Trois variables de plus, **toutes les trois nécessaires** — il en manque
une et aucun email ne part (l'application, elle, continue de marcher) :

```
RESEND_API_KEY=re_...
EMAIL_FROM="Makiti <notifications@ton-domaine.gn>"
NEXT_PUBLIC_SITE_URL=https://ton-domaine.gn
```

- `RESEND_API_KEY` — créée sur [resend.com](https://resend.com), côté
  serveur uniquement (pas de préfixe `NEXT_PUBLIC_`).
- `EMAIL_FROM` — l'adresse d'expédition. **Son domaine doit être vérifié
  chez Resend** (enregistrements DNS SPF et DKIM à poser). Sans domaine
  vérifié, Resend n'accepte d'envoyer qu'à l'adresse du propriétaire du
  compte : suffisant pour un essai, inutilisable en production.
- `NEXT_PUBLIC_SITE_URL` — l'adresse publique du site, **sans barre
  oblique finale**. Elle sert à construire le lien « Répondre » de
  l'email. Elle est lue ici plutôt que déduite de l'en-tête `Host` de la
  requête : un email est ouvert ailleurs et plus tard, son lien doit
  désigner le vrai site.

Ce qui part, et quand : un email au destinataire d'un message, **et
seulement si ce message est le premier non lu de la conversation**. Deux
personnes qui s'écrivent dix fois de suite produisent un seul email ;
le suivant ne repart qu'une fois le fil ouvert. Un rappel de plus
n'apprendrait rien à quelqu'un qui n'est pas revenu, et c'est ainsi
qu'on finit en courrier indésirable.

**Les emails d'authentification ne passent PAS par là** — mot de passe
oublié, confirmation d'inscription. Ils sont envoyés par Supabase Auth,
et se configurent dans le tableau de bord Supabase
(**Authentication → Emails → SMTP Settings**), en y branchant les
identifiants SMTP de Resend. C'est une configuration, pas du code : rien
dans ce dépôt ne les enverra.

### Sur Vercel — à faire avant le premier déploiement

`.env.local` n'est pas versionné : Vercel ne le reçoit donc **jamais**. Les
deux mêmes variables doivent être saisies dans
**Project Settings → Environment Variables** (Production, Preview et
Development), puis le déploiement relancé.

Sans elles le build **échoue**, avec un message qui nomme les deux
variables. C'est volontaire : un site en ligne dont chaque page plante est
pire qu'un déploiement refusé. Si tu vois cette erreur dans les logs
Vercel, il n'y a rien à corriger dans le code — il manque la
configuration.
