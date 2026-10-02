# Tests de navigateur

Les parcours de Filloo, joués par Playwright dans Chromium au format
téléphone, contre une pile Supabase **locale** — jamais la production :
`aide.ts` refuse toute adresse qui n'est pas `127.0.0.1` ou `localhost`,
parce que ces tests créent des comptes, valident des boutiques et en
suppriment.

## Ce qu'ils couvrent

- **`visiteur.spec.ts`** — sans compte : accueil, renvois vers la
  connexion avec le bon `next`, refus d'un mauvais mot de passe et d'une
  confirmation différente, 404.
- **`parcours.spec.ts`** — un seul récit, dans l'ordre : un commerçant
  s'inscrit, ne peut que garder un brouillon, est validé, publie avec
  photo ; un visiteur trouve le produit ; un client écrit, le commerçant
  répond ; puis les refus : espace commerçant fermé au client,
  signalement unique, client suspendu, boutique suspendue hors du
  catalogue, compte supprimé qui ne revient pas.

## Ce qu'ils ne couvrent pas

- **Les photos affichées par `next/image`** : `next.config.ts` n'accepte
  que l'`https`, et la pile locale sert en `http`.
- **Temps réel, push, emails** : les réponses se lisent en rechargeant
  la page, et les services d'envoi n'existent pas en local.

## Les lancer

Il faut Docker. Depuis la racine du dépôt :

```bash
npx supabase start                  # applique supabase/migrations/
npx supabase status -o env          # affiche API_URL, ANON_KEY, SERVICE_ROLE_KEY

export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
export SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
export NEXT_PUBLIC_SITE_URL=http://localhost:3000

npm run build && npm start          # dans un terminal : le build lit ces variables
npm run e2e                         # dans un autre
```

Première fois : `npx playwright install chromium`. Un Chromium déjà
installé ailleurs se donne par `CHROMIUM=/chemin/vers/chrome`.

**Le build doit être refait contre la pile locale** : les variables
`NEXT_PUBLIC_` sont inscrites dans le JavaScript au moment du build, et
un build fait contre la production ferait parler le navigateur à la
production.

Après un échec : `npx playwright show-report e2e/rapport` (captures et
trace de chaque test raté).

## Un test qui ne peut pas échouer ne prouve rien

Le signalement unique a été vérifié par sabotage : sans l'index
`reports_un_seul_en_attente` (migration `0027`), le test voit deux
signalements et échoue. Un nouveau test de refus mérite le même
traitement avant qu'on s'y fie.
