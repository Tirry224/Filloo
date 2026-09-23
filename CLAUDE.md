@AGENTS.md

# Git : où le travail doit vivre

Règle révisée par le porteur du projet le 2026-09-19. Elle remplace celle
du 2026-09-16, dont la branche de travail avait cessé d'exister sans que
personne ne mette ce fichier à jour — une consigne qui désigne une
branche morte ne protège plus rien, elle égare. Elle est écrite ICI et
non dans `AGENTS.md` : ce fichier-là est régénéré en entier par
`next dev` (voir ses marqueurs `BEGIN`/`END`), donc toute règle qu'on y
ajouterait serait effacée à la prochaine commande.

## Une seule branche : `main`

- **`main` est la branche de travail ET la branche déployée.** Tout
  développement y va directement et y est poussé une fois terminé : il
  n'y a plus de branche intermédiaire à tenir à jour.
- **Aucune autre branche ne se crée ni ne s'utilise** pour une tâche de
  ce projet sans autorisation explicite du porteur du projet, demandée et
  obtenue pour cette fois-là.
- **Si l'environnement en impose une** — une session qui ouvre d'office
  une branche `claude/…`, par exemple — y travailler, puis la ramener
  dans `main` en avance rapide et le dire dans le compte rendu, jamais la
  laisser vivre sa vie.
- **Aucune branche ne se supprime ni ne se fusionne** sans autorisation
  explicite, y compris celles qui paraissent mortes : trois d'entre elles
  portent encore, au 2026-09-19, 61 commits absents de `main`.

## Ce que ce choix coûte, et comment on le paie

Pousser sur `main` déclenche un déploiement Vercel : une erreur s'y voit
en production, pas dans une préversion. Le prix de la simplicité se paie
donc AVANT le push, jamais après.

- **Vérifier la branche active — `git branch --show-current` — AVANT la
  première modification**, pas au moment de committer. Se découvrir
  ailleurs après dix fichiers touchés oblige à déplacer des commits,
  c'est-à-dire à faire de la chirurgie Git au lieu du travail demandé.
- **Faire passer `npm run typecheck` et `npm run build` avant de
  pousser.** Si l'environnement ne le permet pas — `node_modules` absent,
  par exemple — le DIRE dans le compte rendu plutôt que pousser en
  silence.
- **Un commit = un changement qui se tient.** Sans branche de secours,
  revenir en arrière consiste à viser un commit précis : un commit
  fourre-tout referme cette porte de sortie.

## Pourquoi la règle a changé

La version du 2026-09-16 séparait une branche stable d'une branche de
travail, pour répondre à un vrai désastre : le travail s'était éparpillé
sur huit branches, dont quatre mortes et deux qui portaient chacune leur
propre version des migrations `0018` et `0019`.

Elle a échoué sur son propre terrain. La branche de travail qu'elle
nommait a disparu en laissant 7 commits jamais fusionnés, deux autres
branches en retiennent 54 de plus, et le fichier a continué pendant ce
temps à désigner une branche introuvable. Pour un projet à un seul
développeur, la branche intermédiaire n'a rien protégé : elle a créé un
endroit de plus où oublier du travail.

La dispersion ne vient jamais d'une grande décision : elle vient d'une
tâche commencée sans regarder où l'on était. C'est ce coup d'œil, et la
vérification avant push, que cette règle impose désormais.

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
à l'ancien `docs/REPRISE.md`, remplacé depuis par `docs/MEMOIRE.md`.

Cette règle porte sur la FORME des comptes rendus, pas sur le reste :
une explication technique, un raisonnement ou une réponse à une question
directe gardent la forme qui les sert le mieux.
