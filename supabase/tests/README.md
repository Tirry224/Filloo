# Tests de sécurité

Ces tests vérifient que le Row Level Security fait vraiment son travail.
Ils s'exécutent sur un PostgreSQL local, sans toucher au projet Supabase.

`_supabase_stub.sql` reproduit le strict minimum de l'environnement Supabase
(le schéma `auth`, la fonction `auth.uid()`, les rôles `anon` et
`authenticated`, le stockage) pour que les migrations puissent tourner
ailleurs que chez Supabase. Ce fichier ne fait pas partie de l'application.

## Lancer les tests

```bash
createdb filloo_test
psql -d filloo_test -f supabase/tests/_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d filloo_test -f "$f"; done
psql -d filloo_test -f supabase/tests/security_test.sql
```

Les 477 vérifications (compte du 2026-11-07, migrations 0063 à 0066
comprises) affichent `OK`. La première qui échoue interrompt tout
avec `ECHEC`.

Un test qui ne peut pas échouer ne prouve rien. Pour le vérifier, rejoue les
migrations en en omettant une, et regarde la suite s'arrêter : sans `0019`,
elle tombe sur « une boutique creee approuvee a sa case cochee » ; sans
`0020`, sur « pending + draft → sold refusé (LA FAILLE) » ; sans `0021`, sur
« cocher la case remplit la file de notifications » ; sans `0022`, sur
« client suspendu : le fil est ferme a l'ecriture » ; sans `0041`, sur
« un compte supprime n'est plus « mon profil client » » puis « le compte
client supprime bloque la recreation » ; sans `0052`, sur « un commercant
ne cree pas son produit « a la une » ». Ces six-là ont été vérifiés en
omettant réellement la migration, pas supposés. Pour `0053` et `0054`
(le 2026-11-07), c'est leur `revoke all` qu'on a retiré : la suite tombe
sur « anon et authenticated n'ont aucun droit sur les deux tables ». Sans
`0055`, `0056` ou `0057`, la suite s'arrête à leur section (vérifié le
2026-11-07 en omettant chacune). Pour `0063`–`0066` (le 2026-11-07), douze
mutations de leurs gardes (refus d'un non-membre, jokers de recherche,
supprimés en dernier, démasquage rejoué, droits retirés sur `equipe` et
`cities`, email confirmé, retrait de soi, comptes de campagnes et de
profils, slug figé) arrêtent chacune la suite sur son contrôle.

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
