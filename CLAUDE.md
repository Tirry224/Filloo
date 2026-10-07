@AGENTS.md

# Git : où le travail doit vivre

Règle révisée par le porteur du projet le 2026-10-07. Elle remplace
celle du 2026-09-19 (« une seule branche : `main` »). Elle est écrite ICI
et non dans `AGENTS.md` : ce fichier-là est régénéré en entier par
`next dev` (voir ses marqueurs `BEGIN`/`END`), donc toute règle qu'on y
ajouterait serait effacée à la prochaine commande.

## Deux branches : `dev` pour travailler, `main` pour la production

- **`dev` est la branche de travail et de test.** Tout développement y
  va et y est poussé. Vercel en fait une PRÉVERSION (adresse à part) :
  c'est là que le porteur du projet teste.
- **`main` est la production.** Pousser sur `main` met en ligne pour les
  vrais utilisateurs. **On n'y touche QUE sur demande explicite du
  porteur du projet**, pour cette fois-là — y compris pour y ramener
  `dev`.
- **Aucune autre branche ne se crée ni ne s'utilise** sans autorisation
  explicite, demandée et obtenue pour cette fois-là.
- **Si l'environnement en impose une** — une session qui ouvre d'office
  une branche `claude/…` — y travailler, puis la ramener dans `dev` (pas
  `main`) et le dire dans le compte rendu.
- **Aucune branche ne se supprime ni ne se fusionne** sans autorisation
  explicite, y compris celles qui paraissent mortes : trois d'entre elles
  portaient encore, au 2026-09-19, 61 commits absents de `main`.

## L'app mobile est dans un autre dépôt

Depuis le 2026-10-07, l'app mobile vit dans `tirry224/filloo-mobile`,
pour qu'un commit ne touche jamais les deux apps à la fois. Ce dépôt-ci
ne porte que le site, la base (migrations) et l'API que l'app appelle.
Toute modification d'une table, d'une politique RLS ou de
`/api/app/message-envoye` doit rester compatible avec l'app déjà
installée sur les téléphones.

## Ce que la préversion NE protège PAS : la base de données

La préversion de `dev` utilise la MÊME base Supabase que la production.
Une migration appliquée « pour tester » s'applique donc aux vraies
données, et un compte ou un message créé en préversion est un vrai
compte, un vrai message.

- **Aucune migration ne s'applique sans accord explicite du porteur du
  projet**, en disant qu'elle touchera la production.
- Une migration appliquée est commitée dans la même session (règle de
  `docs/MEMOIRE.md`), sur `dev`.

## Avant chaque push

- **Vérifier la branche active — `git branch --show-current` — AVANT la
  première modification**, pas au moment de committer.
- **Faire passer `npm run typecheck` et `npm run build` avant de
  pousser.** Si l'environnement ne le permet pas, le DIRE dans le compte
  rendu plutôt que pousser en silence.
- **Un commit = un changement qui se tient**, pour pouvoir revenir en
  arrière sur un commit précis.

## Pourquoi la règle a changé

- **2026-09-16** : une branche stable et une branche de travail, après
  un travail éparpillé sur huit branches. La branche de travail a
  disparu sans que ce fichier soit mis à jour.
- **2026-09-19** : tout sur `main`, pour ne plus oublier de travail
  ailleurs. Prix payé : chaque push partait en production.
- **2026-10-07** : pendant le premier test avec de vrais utilisateurs,
  le porteur du projet a refusé que les essais partent en production.
  `dev` revient, mais NOMMÉE ici et seule autorisée, pour ne pas refaire
  la dispersion de septembre.

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

## Le strict nécessaire

Règle donnée par le porteur du projet le 2026-09-27 : **répondre court.**
Il ne veut pas lire beaucoup de texte.

- Seulement ce qui compte : ce qui a été fait, ce qui bloque, ce qu'il
  doit décider. Pas de contexte qu'il connaît déjà, pas de répétition.
- Les listes de la règle ci-dessus restent, mais courtes : peu
  d'entrées, une phrase brève chacune.
- Pas de leçon ni de question de réflexion par défaut ; seulement si
  elle change vraiment quelque chose.
