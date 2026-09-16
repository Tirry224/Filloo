# Tests de sécurité

Ces tests vérifient que le Row Level Security fait vraiment son travail.
Ils s'exécutent sur un PostgreSQL local, sans toucher au projet Supabase.

`_supabase_stub.sql` reproduit le strict minimum de l'environnement Supabase
(le schéma `auth`, la fonction `auth.uid()`, les rôles `anon` et
`authenticated`, le stockage) pour que les migrations puissent tourner
ailleurs que chez Supabase. Ce fichier ne fait pas partie de l'application.

## Lancer les tests

```bash
createdb makiti_test
psql -d makiti_test -f supabase/tests/_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d makiti_test -f "$f"; done
psql -d makiti_test -f supabase/tests/security_test.sql
```

Les 138 vérifications affichent `OK`. La première qui échoue interrompt tout
avec `ECHEC`.

Un test qui ne peut pas échouer ne prouve rien. Pour le vérifier, rejoue les
migrations en en omettant une, et regarde la suite s'arrêter : sans `0019`,
elle tombe sur « une boutique creee approuvee a sa case cochee » ; sans
`0020`, sur « pending + draft → sold refusé (LA FAILLE) ».

## Ce que ces tests protègent

Un test de sécurité utile ne vérifie pas que les actions autorisées
fonctionnent — ça, le premier utilisateur s'en apercevra. Il vérifie que les
actions **interdites** échouent. C'est la partie qu'on ne découvre jamais en
utilisant l'application normalement, et celle qui fait les fuites de données.

Ces tests ont déjà servi deux fois :

1. **Un commerçant pouvait s'auto-valider.** Révoquer un privilège au
   niveau colonne est sans effet quand le privilège `UPDATE` existe au
   niveau table — ce que Supabase accorde par défaut.
2. **Un participant pouvait réécrire le message de l'autre.** La policy
   « marquer comme lu » autorise la modification des messages reçus ; sans
   liste blanche de colonnes, cette autorisation couvrait aussi le texte.

Les deux corrections sont documentées dans la partie 4 de
`0002_rules_and_security.sql`. Les deux failles avaient le même profil :
aucune erreur, aucun symptôme, rien qu'une porte ouverte.

**Règle : toute nouvelle policy s'accompagne d'un test qui prouve qu'elle
bloque bien ce qu'elle prétend bloquer.**
