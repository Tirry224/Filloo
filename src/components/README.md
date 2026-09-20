# Composants

Trois dossiers, une règle de rangement simple :

| Dossier | Contient | Exemple |
|---|---|---|
| `ui/` | Les briques **sans métier**. Elles ignorent tout de Makiti. | `Button`, `Card`, `Field`, `EmptyState` |
| `product/` | Ce qui parle de **produits et de boutiques**. | `ProductCard`, `PriceTag`, `MerchantCard` |
| `chat/` | Ce qui parle de **messagerie**. | `MessageBubble`, `ProductRef`, `ThreadRow` |

Un composant de `ui/` ne doit jamais importer un type du domaine. S'il a
besoin de connaître un produit, sa place est dans `product/`. C'est cette
frontière qui rend `ui/` réutilisable tel quel dans un autre projet.

## Quand extraire un composant

**Au deuxième usage, pas au premier.** La carte de choix du rôle
(`RoleCard`) ne sert que sur l'écran d'inscription : elle reste dans le
fichier de la page. Un dossier rempli de composants à usage unique est plus
difficile à lire qu'une page un peu longue.

## Voir la bibliothèque

```bash
npm run dev
```

Puis `/styleguide` : tous les composants sur une seule page, hors de tout
écran. À consulter avant d'en écrire un nouveau — il existe peut-être déjà.

## Composants serveur

Le défaut est le composant SERVEUR, et il le reste : c'est ce qui permet aux
fiches produits d'être lisibles par Google et partageables sur WhatsApp avec
un aperçu, et c'est ce qui coûte zéro octet au visiteur.

Ce fichier a longtemps affirmé qu'« aucun fichier ne porte `"use client"` ».
C'était vrai à l'écriture, faux depuis : **24 fichiers en portent un**
aujourd'hui. Chacun doit satisfaire l'un des trois critères de la règle R3
de `docs/PERFORMANCE.md` — économiser plus d'octets qu'il n'en pèse, donner
une information que le serveur n'a pas, ou éviter un aller-retour réseau —
et écrire cette raison dans le fichier. Un document qui décrit un état
révolu est pire qu'un document absent : il endort la vigilance qu'il
prétendait tenir.
