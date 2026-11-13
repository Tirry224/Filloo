import { createServerClient } from "@supabase/ssr";
import { isAuthSessionMissingError, type JwtPayload, type User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { naQueLAdmin } from "@/lib/proprietaire";
import { aUnMotDePasse, CHEMIN_CREER_MOT_DE_PASSE } from "@/lib/password";

/**
 * Les préfixes qui exigent une session, quels que soient les rôles
 * qu'elle porte. Le contrôle fait ici s'arrête à « une session existe » ;
 * le RÔLE se vérifie dans `src/app/(vendeur)/layout.tsx` — voir plus bas.
 */
const ESPACES_AUTHENTIFIES = ["/vendeur", "/compte", "/messages", "/admin", "/equipe"];

/** Ce que le compte du porteur du projet peut encore ouvrir (voir plus bas). */
/* `/admin` depuis le 2026-11-05 : l'espace de l'équipe (0042) remplace
   `/suivi`, supprimée à la demande du porteur du projet. */
const CHEMINS_DU_PROPRIETAIRE = ["/admin", "/api", "/auth", "/reinitialiser-mot-de-passe"];

/**
 * `supabaseResponse` est reconstruit après `getClaims()` : `setAll` doit
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
/**
 * Ce que le middleware lit du jeton pour `naQueLAdmin`. Le jeton ne porte
 * pas `email_confirmed_at` : on le tient pour confirmé, ce qui ne donne
 * AUCUN droit — ici, être reconnu propriétaire ou membre de l'équipe ne
 * fait que RESTREINDRE la navigation à `/admin`, où `requireEquipe`
 * revérifie tout auprès de Supabase. `app_metadata` n'est écrit que par
 * le serveur (0043) et le jeton est signé : il ne se fabrique pas.
 */
function utilisateurDuJeton(claims: JwtPayload): Pick<User, "email" | "email_confirmed_at" | "app_metadata"> {
  const email = typeof claims.email === "string" ? claims.email : undefined;
  return {
    email,
    email_confirmed_at: email ? "jeton" : undefined,
    app_metadata: (claims.app_metadata ?? {}) as User["app_metadata"],
  };
}

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

  /* Ne PAS retirer : c'est cet appel qui déclenche le rafraîchissement du
     jeton (`getClaims` passe par `getSession`), nécessaire même sans le
     refus ci-dessous.

     `getClaims()` et non plus `getUser()` (2026-11-08) : le projet signe
     ses jetons en ECC P-256 (constaté par le porteur du projet), la
     signature se vérifie donc ICI, avec la clé publique gardée dix minutes
     en mémoire, sans aller-retour vers Supabase. Avant, chaque page,
     préchargement et action d'un compte connecté faisait un appel à
     `/auth/v1/user` dans le middleware PUIS un second dans la page
     (1 752 appels sur 3 855 requêtes en 24 h, constaté le 2026-11-07).
     Un ancien jeton symétrique (HS256) retombe tout seul sur `getUser()`.

     Ce que l'on perd, et pourquoi c'est acceptable : un jeton signé reste
     valable jusqu'à son expiration (une heure) même si le compte vient
     d'être supprimé ou banni. Le middleware ne décide que « y a-t-il une
     session ? » et « faut-il renvoyer vers /admin ? » ; la page revérifie
     auprès de Supabase (`getSessionUser`, toujours `getUser()`) et la base
     refuse toute écriture d'une connexion fermée (0068). */
  const { data: lecture, error } = await supabase.auth.getClaims();
  const claims = lecture?.claims ?? null;
  const user = claims ? utilisateurDuJeton(claims) : null;

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

  /* Le compte du porteur du projet et ceux de l'équipe (0043, décision
     du 2026-11-05) ne voient QUE `/admin` (règle du
     2026-10-07) : toute autre page l'y renvoie. Ici et non dans chaque
     layout, parce que c'est le seul endroit par où passent TOUTES les
     pages ; et sans coût, `user` étant déjà lu ci-dessus. Restent
     ouverts : les actions serveur (la déconnexion en est une), les
     routes techniques (`/api`, `/auth` pour les liens reçus par e-mail),
     la réinitialisation du mot de passe, et les fichiers. */
  if (
    naQueLAdmin(user) &&
    !actionServeur &&
    !CHEMINS_DU_PROPRIETAIRE.some((p) => chemin === p || chemin.startsWith(`${p}/`)) &&
    !/\.[a-z0-9]+$/i.test(chemin)
  ) {
    const admin = request.nextUrl.clone();
    admin.pathname = "/admin";
    admin.search = "";
    // Les cookies que `getClaims()` vient peut-être de rafraîchir partent
    // avec la redirection, sinon la session expirerait au tour suivant.
    const redirection = NextResponse.redirect(admin);
    supabaseResponse.cookies.getAll().forEach((c) => redirection.cookies.set(c));
    return redirection;
  }

  /* UN MOT DE PASSE POUR TOUS (décision du porteur du projet,
     2026-11-13) : un compte venu de Google en crée un, une fois, avant
     d'aller plus loin. Ici et non dans un layout, pour la même raison que
     ci-dessus : toutes les pages passent par là. Restent ouverts : la page
     de création elle-même, les actions serveur (la déconnexion, la
     création du mot de passe), les routes techniques, l'écran
     « Complétez votre compte » (`/inscription`, exactement : la boutique
     vient APRÈS le mot de passe) et les fichiers. L'équipe n'est pas
     concernée : elle ne voit que `/admin`, déjà tranché plus haut.

     `aUnMotDePasse` lit `app_metadata`, signé dans le jeton : la marque
     posée à la création y entre au rafraîchissement que fait
     `createMyPasswordAction`. */
  if (
    user &&
    !aUnMotDePasse(user) &&
    // Sans cette ligne, un membre de l'équipe venu de Google tournerait
    // sans fin entre `/admin` et la page de création.
    !naQueLAdmin(user) &&
    !actionServeur &&
    chemin !== CHEMIN_CREER_MOT_DE_PASSE &&
    chemin !== "/inscription" &&
    !["/api", "/auth"].some((p) => chemin === p || chemin.startsWith(`${p}/`)) &&
    !/\.[a-z0-9]+$/i.test(chemin)
  ) {
    const creer = request.nextUrl.clone();
    creer.pathname = CHEMIN_CREER_MOT_DE_PASSE;
    creer.search = "";
    creer.searchParams.set("next", chemin + request.nextUrl.search);
    const redirection = NextResponse.redirect(creer);
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
