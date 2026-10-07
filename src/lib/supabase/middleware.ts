import { createServerClient } from "@supabase/ssr";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { estProprietaire } from "@/lib/proprietaire";

/**
 * Les préfixes qui exigent une session, quels que soient les rôles
 * qu'elle porte. Le contrôle fait ici s'arrête à « une session existe » ;
 * le RÔLE se vérifie dans `src/app/(vendeur)/layout.tsx` — voir plus bas.
 */
const ESPACES_AUTHENTIFIES = ["/vendeur", "/compte", "/messages", "/suivi"];

/** Ce que le compte du porteur du projet peut encore ouvrir (voir plus bas). */
const CHEMINS_DU_PROPRIETAIRE = ["/suivi", "/api", "/auth", "/reinitialiser-mot-de-passe"];

/**
 * `supabaseResponse` est reconstruit après `getUser()` : `setAll` doit
 * écrire sur la MÊME réponse que celle envoyée au navigateur, sinon les
 * cookies rafraîchis ne partent jamais.
 *
 * Une seule source de vérité par question, et le rôle ne se vérifie donc
 * pas ici :
 *   - AU BORD : « y a-t-il une session ? » — dans le cookie, coût nul.
 *   - SUR LE SERVEUR (`(vendeur)/layout.tsx`) : « cette session a-t-elle un
 *     profil commerçant actif ? » — en base, une seule fois.
 *
 * Le faire ici ajouterait une requête `profiles` à chaque page vue,
 * catalogue public compris, pour un second exemplaire qui finirait par
 * diverger. Et un cookie n'est pas une autorisation.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    },
  );

  // Ne PAS retirer : c'est cet appel qui déclenche le rafraîchissement du
  // jeton, nécessaire même sans le refus ci-dessous.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  /* « Pas de session » est une réponse ; tout le reste est une panne (même
     distinction que dans `getSessionUser`). On ne refuse donc que sur un
     refus CERTAIN : sur une coupure passagère, l'ordinaire d'un réseau
     guinéen, laisser passer fait dire « Pas de connexion » à la frontière
     d'erreur de la page, et rien n'est ouvert pour autant — le layout de
     `(vendeur)` et le RLS refusent en base.

     Limite connue : si le jeton est déjà EXPIRÉ et Supabase injoignable,
     `@supabase/ssr` efface la session de son côté et l'appel suivant
     renvoie honnêtement sur `/connexion`. Cela ne se corrige pas ici. */
  const panneAuth = Boolean(error) && !isAuthSessionMissingError(error!);

  const chemin = request.nextUrl.pathname;
  const espacePrive = ESPACES_AUTHENTIFIES.some((p) => chemin === p || chemin.startsWith(`${p}/`));

  /* Un ENVOI de formulaire (action serveur : POST portant `next-action`)
     ne se redirige pas. Le navigateur suivait la redirection en POST vers
     `/connexion`, recevait une page au lieu de la réponse de l'action, et
     l'écran entier tombait sur « Une erreur est survenue de notre côté »,
     saisie perdue — constaté le 2026-09-25 en enregistrant son profil
     dans un onglet après s'être déconnecté dans un autre. L'action se
     protège elle-même (session vérifiée, RLS) et répond « reconnectez-
     vous » DANS le formulaire. */
  const actionServeur = request.method === "POST" && request.headers.has("next-action");

  /* Le compte du porteur du projet ne voit QUE `/suivi` (règle du
     2026-10-07) : toute autre page l'y renvoie. Ici et non dans chaque
     layout, parce que c'est le seul endroit par où passent TOUTES les
     pages ; et sans coût, `user` étant déjà lu ci-dessus. Restent
     ouverts : les actions serveur (la déconnexion en est une), les
     routes techniques (`/api`, `/auth` pour les liens reçus par e-mail),
     la réinitialisation du mot de passe, et les fichiers. */
  if (
    estProprietaire(user) &&
    !actionServeur &&
    !CHEMINS_DU_PROPRIETAIRE.some((p) => chemin === p || chemin.startsWith(`${p}/`)) &&
    !/\.[a-z0-9]+$/i.test(chemin)
  ) {
    const suivi = request.nextUrl.clone();
    suivi.pathname = "/suivi";
    suivi.search = "";
    // Les cookies que `getUser()` vient peut-être de rafraîchir partent
    // avec la redirection, sinon la session expirerait au tour suivant.
    const redirection = NextResponse.redirect(suivi);
    supabaseResponse.cookies.getAll().forEach((c) => redirection.cookies.set(c));
    return redirection;
  }

  if (espacePrive && !user && !panneAuth && !actionServeur) {
    /* `?next=` porte la destination voulue jusqu'à l'écran de connexion :
       le même paramètre que l'écran 16, plutôt qu'un second mécanisme avec
       sa propre validation à tenir à jour. Il est filtré par `safeNextPath`
       du côté de qui le LIT, seule place où la garde protège vraiment. */
    const connexion = request.nextUrl.clone();
    connexion.pathname = "/connexion";
    connexion.search = "";
    connexion.searchParams.set("next", chemin + request.nextUrl.search);
    return NextResponse.redirect(connexion);
  }

  return supabaseResponse;
}
