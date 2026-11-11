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

Les 701 vérifications (compte du 2026-11-11, migrations jusqu'à 0076
comprise) affichent `OK`. La première qui échoue interrompt tout
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
profils, slug figé) arrêtent chacune la suite sur son contrôle. Pour
`0067` (le 2026-11-07), neuf mutations (garde du propriétaire à l'ajout,
garde « le propriétaire ne se retire pas », égalité de date du premier
propriétaire, filtre `p_role`, ordre des photos, refus d'un profil non
supprimé au journal, motif de suppression d'un produit, renumérotation
des catégories, puis des villes) arrêtent chacune la suite sur son
contrôle.
Pour `0068` (le 2026-11-07), vingt mutations arrêtent chacune la suite
sur son contrôle : la garde de connexion fermée retirée de la recréation
de profil, de la modification de profil, de l'abonnement push (insertion,
puis `using` et `with check` ensemble), d'`enregistrer_telephone`, des
deux `marquer_*_lu*`, de `je_suis_de_l_equipe` et de `je_suis_proprietaire` ;
`deleted_at` et le bannissement échu dans `ma_connexion_est_fermee` ; la
suppression des jetons sans session, le filtre `user_id` et le `revoke`
de `fermer_les_sessions` ; `is_suspended` de la modification de profil ;
le profil actif de chacune des six policies du stockage. Le stub porte
désormais `auth.users.banned_until`, `auth.sessions` et
`auth.refresh_tokens` (mêmes clés étrangères qu'en production).
Pour `0069` (le 2026-11-07), six mutations arrêtent chacune la suite sur
son contrôle : le filtre `sender_id <>` du compte commerçant, le filtre
d'espace du compte client (commerçant qui est aussi client), la remise à
vide de `last_used_at` quand l'appareil change de connexion, la garde de
connexion fermée d'`enregistrer_appareil_push`, le `revoke` d'une
fonction de trigger, la borne de 2048 caractères de l'adresse.
Pour `0074` (le 2026-11-10), sept mutations arrêtent chacune la suite
sur son contrôle : `c.visible` retiré du trigger, de `search_products`,
de `produits_sponsorises` ; le trigger qui ne laisse plus passer un
changement sans changement de catégorie ; « mixte » retiré du filtre
femme/homme ; la borne basse du prix rendue stricte ; le droit de
colonne sur genre/tailles/couleurs retiré. La tête du fichier rend
visibles les catégories 1 à 3 (masquées par 0074) pour les sections
antérieures, après avoir gardé l'état des migrations pour la section 0074.
Pour `0075` (le 2026-11-11), trois mutations arrêtent chacune la suite
sur son contrôle : la garde d'équipe de `ranger_categorie` retirée, la
garde « dernière catégorie visible » retirée, l'exécution rendue à `anon`.
Pour `0076` (le 2026-11-11), quatorze mutations arrêtent chacune la suite
sur son contrôle : le `delete` du déclencheur d'`equipe`, sa garde
d'activité, chacun des six critères d'activité (boutique, conversation
comme client, blocage, message, signalement, journal), le refus d'un
profil pour un membre, le `update of auth_user_id` de ce refus, le filtre
d'`equipe_comptes`, celui de `suivi_chiffres`, la garde du nettoyage, un
`revoke` ; puis trois de `effacer_profil_decide` (le cas d'Alpha Nouhou
tranché le 2026-11-11) : le nom du membre retiré de ses deux filtres,
la borne « autre conversation », la borne « signalement fait ». Omettre `0076` ne prouve que l'absence du déclencheur (la
section 0067 le lève). Depuis `0076`, un membre n'a plus de profil : la
section 0043 fait entrer une connexion neuve (Q43) au lieu de D, qui a
une activité, et les contrôles qui ont besoin d'un membre AVEC profil
(fiche `est_de_l_equipe`, filtres) lèvent le déclencheur
`profil_hors_equipe` dans un `begin … rollback`.

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
