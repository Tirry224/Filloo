# Sauvegarde et restauration de Filloo

Décidé par le porteur du projet le 2026-11-08 : une copie chaque nuit
HORS de Supabase, dans Cloudflare R2. Le travail est fait par
`.github/workflows/sauvegarde.yml` (02:23 UTC) et les scripts de
`scripts/sauvegarde/`.

## Ce qui est protégé

| Quoi | Où dans R2 | Gardé |
|---|---|---|
| La base (rôles, schéma, données, connexions comprises), chiffrée | `base/AAAA-MM-JJ/base.tar.gz.age` | 30 jours (règle du bucket) |
| Le nombre de lignes de chaque table, en clair | `base/AAAA-MM-JJ/comptes.tsv` | 30 jours |
| Les photos des produits et des boutiques | `photos/<bucket>/` | tant qu'elles existent |
| Une photo effacée chez Supabase | `photos-effacees/AAAA-MM-JJ/<bucket>/` | 30 jours (règle du bucket) |

Ce qui ne l'est PAS, et se refait à la main : les variables de Vercel
(liste dans `README.md`), les réglages de Supabase Auth (modèles d'email,
URL de redirection, captcha), le DNS du domaine.

Chaque nuit, la copie est **restaurée** dans une base Supabase jetable
sur la machine de GitHub, et chaque table doit y compter le même nombre
de lignes : si ce n'est pas le cas, le workflow échoue et GitHub envoie un
e-mail. La copie de la nuit n'est envoyée qu'après cette vérification.

## Mise en place (une fois, par le porteur du projet)

1. **La clé de chiffrement**, sur ton ordinateur :
   `age-keygen -o filloo-sauvegarde.key`. La ligne `# public key: age1…`
   va dans GitHub ; le FICHIER reste chez toi, hors du dépôt, avec une
   seconde copie (clé USB, gestionnaire de mots de passe). **Sans lui,
   les copies de la base sont illisibles, y compris pour toi.**
2. **Cloudflare R2** : créer le bucket `filloo-sauvegardes` (région
   automatique, accès PUBLIC désactivé). Dans le bucket → Settings →
   Object lifecycle rules : supprimer `base/` après 30 jours, et
   `photos-effacees/` après 30 jours. Puis R2 → Manage API tokens →
   Create token : « Object Read & Write », limité à CE bucket.
3. **Supabase** : Storage → S3 Connection → New access key. Et Connect →
   Session pooler : copier l'adresse (avec le mot de passe de la base).
4. **GitHub** → Settings → Secrets and variables → Actions : les huit
   secrets listés en tête de `sauvegarde.yml`.
5. **Lancer une première fois** : Actions → Sauvegarde → Run workflow.
   C'est elle qui prouve que tout marche.

Coût : R2 est gratuit jusqu'à 10 Go stockés (au 2026-11-08 : moins de
1 Mo de photos, 15 Mo de base) ; GitHub Actions est gratuit pour ce
volume.

## Restaurer (le jour où il le faut)

Jamais par-dessus la production : on restaure dans un projet NEUF, on
vérifie, puis on bascule le site dessus.

1. Créer un nouveau projet Supabase (même région : Paris, `eu-west-3`).
2. Récupérer la copie voulue dans R2 et la déchiffrer :
   `age -d -i filloo-sauvegarde.key base.tar.gz.age | tar -xz -C copie/`
3. Restaurer et vérifier (le script refuse une base non vide) :
   `scripts/sauvegarde/restaurer.sh copie/ "<adresse Session pooler du NOUVEAU projet>"`
4. Recopier les photos dans les deux buckets du nouveau projet :
   `rclone sync r2:filloo-sauvegardes/photos/product-images sb-neuf:product-images`
   (idem `shop-photos`), avec des clés S3 du nouveau projet.
5. Refaire à la main ce qui n'est pas dans la copie (voir plus haut), puis
   changer dans Vercel `NEXT_PUBLIC_SUPABASE_URL`, la clé publique et
   `SUPABASE_SERVICE_ROLE_KEY`, et redéployer.

Les connexions restent valides (les mots de passe sont dans `auth.users`),
mais chacun devra se reconnecter : les jetons de l'ancien projet ne sont
pas reconnus par le nouveau.

## Limites connues

- **Une ligne écrite entre la copie et le comptage** (quelques secondes)
  fait échouer la vérification : fausse alerte possible, rare à 2 h du
  matin. Relancer le workflow.
- **La pile jetable suit la version de la CLI** (`supabase@3.0.0`) : si
  `auth.users` de la production gagne une colonne que cette version ne
  connaît pas, la restauration échoue. C'est voulu : mieux vaut le savoir
  la nuit que le jour de la panne. Monter alors la version de la CLI.
- **La sauvegarde de Supabase (7 jours)** reste en place : elle restaure
  plus vite, mais vit chez le même fournisseur et ne contient pas les
  photos.
