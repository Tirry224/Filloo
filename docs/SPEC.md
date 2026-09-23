# Filloo — Spécification de la v1

Marketplace de mise en relation : des commerçants publient leurs produits,
des clients les parcourent et contactent le commerçant par messagerie interne.
**Aucun paiement, aucun panier, aucune livraison** : la transaction se fait hors
de l'application.

Marché : Guinée · Devise : franc guinéen (GNF) · Langue : français.

---

## 1. Décisions validées

| # | Sujet | Décision |
|---|-------|----------|
| 1 | Authentification | Email + mot de passe. Téléphone obligatoire mais **non vérifié** (pas de SMS, pas de coût). **Confirmation d'email OBLIGATOIRE** (décision du 2026-09-17) : l'email est à la fois identifiant de connexion et canal de notification, donc sans confirmation quelqu'un peut s'inscrire avec l'adresse d'un tiers, qui recevra ses messages. La friction est assumée. **Ne s'active qu'une fois le SMTP de production posé côté Supabase** — activée avant, elle rend l'inscription impossible pour tout le monde. |
| 2 | Navigation | Catalogue **libre sans compte**. Compte obligatoire uniquement pour envoyer un message. |
| 3 | Catégories | Liste **fixe**, gérée par l'administrateur. **Révisé le 2026-09-22 : 9, après suppression d'« Autre » (migration 0025).** La base en portait 10 dont un fourre-tout, que cette décision excluait pourtant depuis l'origine — la contradiction a vécu depuis 0003. Une catégorie fourre-tout est toujours le choix le moins coûteux au moment de publier : elle se remplit, et vide les autres de leur sens. Nommer une dixième catégorie RÉELLE reste possible ; neuf qui veulent dire quelque chose valent mieux qu'une dixième inventée pour tenir un compte. |
| 4 | Classement du fil | Pas de notation. Tri : *à la une* (manuel) → *populaires* (nb de conversations) → *récents*. |
| 5 | Notification commerçant | v1 : badge de non-lus + email. Push web reporté en v2. |
| 5b | Structure des fils | **Un seul fil par couple (client, boutique).** Chaque message référence le produit dont il parle ; le premier message d'un fil en porte obligatoirement un. |
| 6 | Modération produits | Publication immédiate, bouton « signaler », masquage possible par l'admin. |
| 7 | Volume cible | 500 commerçants **à un an**. Densité avant volume au lancement. |
| 8 | Rôles | **Comptes liés** : une personne peut avoir un compte client **et** un compte commerçant derrière **une seule connexion** (email + mot de passe), avec bascule rapide depuis l'app, sans se reconnecter. **Jamais les deux mélangés sur un même écran** : à tout instant on est soit client, soit commerçant. Chaque profil a son propre historique et sa propre modération — suspendre le compte client ne gèle pas la boutique. Le second compte se crée depuis l'application, sans repasser par l'inscription. Révise l'ancienne règle « un compte = un seul rôle, modifiable à la main par l'admin ». |
| 9 | Ville | Filtre **manuel** choisi par le client. Jamais de filtrage automatique. |
| 10 | Disponibilité | Binaire (disponible / vendu). **Pas de gestion de stock.** |
| 11 | Validation commerçant | Manuelle, via le tableau de bord Supabase. Aucune page admin en v1. **Critère arrêté le 2026-09-17 : le porteur du projet APPELLE le commerçant et confirme de vive voix.** Un numéro qui répond et une personne qui assume sa boutique, c'est tout le filtre — il ne passe pas à l'échelle, et c'est voulu tant qu'on vise la densité avant le volume (décision 7). |
| 12 | Commerçant en attente | Voit un message d'attente, peut préparer sa boutique et ses produits en **brouillon**. |
| 13 | Abus | Bouton « signaler » + suspension de compte + deux quotas : 20 boutiques contactées/jour et 100 messages/jour par compte. |
| 14 | Recherche | Sur le titre, la description et le nom de la boutique. Insensible aux accents. |
| 15 | Photos | 1 minimum, 3 maximum. Compression avant envoi. Coûts assumés par le porteur du projet. |
| 16 | Litige | Suspension du compte vendeur. **Une suspension gèle les fils DANS LES DEUX SENS** (décision du 2026-09-17, migration `0022`) : on ne communique pas avec un compte suspendu, qu'il soit client ou boutique. Les fils restent entièrement LISIBLES — lecture seule, jamais suppression. |
| 17 | Monétisation | Aucune en v1 (choix assumé). |
| 18 | Hébergement | Vercel, sous-domaine `.vercel.app`. |

## 2. Hors périmètre de la v1

Paiement en ligne · panier · livraison · gestion de stock · notation et avis ·
notifications push · application mobile native · page d'administration ·
multi-boutiques par commerçant · plusieurs langues.

## 3. Parcours utilisateurs

**Visiteur** — arrive sur le fil, filtre par ville et catégorie, recherche,
ouvre une fiche produit. Pour écrire, on lui demande de créer un compte.

**Client** — s'inscrit (nom, email, téléphone, mot de passe), ouvre une
conversation sur un produit, échange avec le commerçant, peut signaler.

**Commerçant** — s'inscrit, renseigne sa boutique (nom, ville, téléphone
WhatsApp), attend la validation en préparant ses produits en brouillon. Une
fois approuvé, il publie, reçoit les messages et répond.

**Une même personne, client et commerçant** — une seule connexion (email +
mot de passe) donne accès aux deux comptes liés si les deux existent. Un
menu permet de basculer de l'un à l'autre. Les deux espaces ne sont jamais
visibles ni mélangés sur un même écran : la bascule change complètement le
contexte (données, navigation, ton des textes).

**Administrateur** — travaille directement dans le tableau de bord Supabase :
approuve les commerçants, masque un produit, suspend un compte, met un
produit à la une.

## 4. Risques identifiés

1. **Amorçage** — une marketplace vide n'attire personne. Priorité au
   recrutement des premiers commerçants sur une zone unique, pas au volume.
2. **Réactivité des commerçants** — un message sans réponse tue la confiance.
   C'est la raison d'être de la notification par email.
3. **Confiance** — aucune vérification des vendeurs au-delà d'un contrôle
   humain sommaire. Prévoir des conditions d'utilisation avant le lancement.

## 5. Questions encore ouvertes

- Liste définitive des **9 catégories** et des **villes** — le NOMBRE est
  tranché (10), les libellés ne le sont pas.
- Conditions générales d'utilisation à rédiger avant la mise en ligne.

*Tranchées le 2026-09-17, et donc sorties d'ici : le critère de
validation (décision 11), le nombre de catégories (décision 3), la
confirmation d'email (décision 1) et la symétrie de la suspension
(décision 16). Une question qui reste écrite après avoir été tranchée se
rediscute à la session suivante.*
