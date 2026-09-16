@AGENTS.md

# Git : où le travail doit vivre

Règle donnée par le porteur du projet le 2026-09-16, et qui ne se
rediscute pas. Elle est écrite ICI et non dans `AGENTS.md` : ce
fichier-là est régénéré en entier par `next dev` (voir ses marqueurs
`BEGIN`/`END`), donc toute règle qu'on y ajouterait serait effacée à la
prochaine commande.

## Les deux branches, et rien d'autre

- **`main` est la branche STABLE.** On n'y développe pas, on n'y pousse
  pas — jamais sans autorisation explicite du porteur du projet, demandée
  et obtenue pour cette fois-là.
- **`claude/verify-main-branches-pe8bp4` est la branche de TRAVAIL
  actuelle.** Tout développement y va, sans exception.
- **Aucune autre branche ne se crée ni ne s'utilise** pour une tâche de
  ce projet sans autorisation explicite.
- **Aucune branche ne se supprime ni ne se fusionne** sans autorisation
  explicite, y compris celles qui paraissent mortes.

## Le réflexe, avant chaque tâche

**Vérifier la branche active — `git branch --show-current` — AVANT la
première modification, pas au moment de committer.** Se découvrir sur la
mauvaise branche après dix fichiers touchés oblige à déplacer des
commits, c'est-à-dire à faire de la chirurgie Git au lieu du travail
demandé.

Si la branche active n'est pas la branche de travail : y basculer d'abord,
et le dire dans le compte rendu.

## Pourquoi cette règle existe

Le travail de ce projet s'est retrouvé éparpillé sur huit branches, dont
quatre mortes et deux qui portaient chacune leur propre version des
migrations `0018` et `0019`. Retrouver ce qui était réellement dans
`main` a demandé une comparaison branche par branche, et deux correctifs
applicatifs y manquaient encore.

La dispersion ne vient jamais d'une grande décision : elle vient d'une
tâche commencée sans regarder où l'on était. C'est ce coup d'œil, et lui
seul, que cette règle impose.

# Comment me répondre

Règle donnée par le porteur du projet le 2026-09-13, et qui ne se
rediscute pas.

**Tout compte rendu se fait sous forme de LISTE, avec une phrase
d'explication par entrée.** Cela vaut pour : ce qui a été fait, ce qui
reste à faire, ce qui a été trouvé, ce qui a été décidé, ce qui a
échoué — et pour tout autre état des lieux, quelle que soit la question
qui l'a déclenché.

Une entrée = un élément + une phrase qui dit pourquoi il compte ou ce
qu'il implique. Pas un paragraphe, pas un seul mot : une phrase.

Écrire en prose ce qui pouvait s'énumérer oblige le lecteur à
reconstituer la liste lui-même — et c'est exactement ce qui était arrivé
à `docs/REPRISE.md` avant sa réécriture.

Cette règle porte sur la FORME des comptes rendus, pas sur le reste :
une explication technique, un raisonnement ou une réponse à une question
directe gardent la forme qui les sert le mieux.
