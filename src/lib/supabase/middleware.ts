import { createServerClient } from "@supabase/ssr";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

/**
 * Les préfixes qui exigent une session, quels que soient les rôles
 * qu'elle porte. Écrits ici en toutes lettres plutôt que déduits : une
 * liste qu'on lit en trois secondes est une liste qu'on maintient.
 *
 * `/vendeur` y est, mais le contrôle fait au bord s'arrête à « une
 * session existe ». Le ROLE, lui, se vérifie dans
 * `src/app/(vendeur)/layout.tsx` — voir plus bas pourquoi les deux ne
 * sont pas au même endroit.
 */
const ESPACES_AUTHENTIFIES = ["/vendeur", "/compte", "/messages"];

/**
 * Rafraîchit le cookie de session à chaque requête, et refuse au bord les
 * espaces privés aux visiteurs anonymes.
 *
 * Sans le rafraîchissement, un jeton expiré ne se renouvelle jamais et la
 * session se coupe en plein milieu d'une visite. `supabaseResponse` est
 * reconstruit après `getUser()` plutôt que réutilisé : `setAll` doit écrire
 * sur la MÊME réponse que celle envoyée au navigateur, sinon les cookies
 * rafraîchis ne partent jamais.
 *
 * POURQUOI LE CONTRÔLE DE RÔLE N'EST PAS ICI, alors que ce serait le
 * réflexe. Ce middleware tourne sur CHAQUE requête, catalogue public
 * compris ; savoir si une session porte un profil commerçant demande
 * d'interroger `profiles`, soit une requête de base ajoutée à chaque page
 * vue sur une application qui se mesure sur un réseau guinéen. Et ce
 * contrôle existerait alors en DEUX exemplaires, ici et dans le layout,
 * avec le risque classique qu'ils divergent — le défaut même qu'on vient de
 * corriger en retirant sept gardes recopiées.
 *
 * Le partage retenu n'a qu'une source de vérité par question :
 *   - AU BORD : « y a-t-il une session ? » — réponse dans le cookie, aucune
 *     requête, coût nul. Évite de rendre une page pour la jeter ensuite.
 *   - SUR LE SERVEUR (`(vendeur)/layout.tsx`) : « cette session a-t-elle un
 *     profil commerçant actif ? » — réponse en base, une seule fois.
 *
 * Un contrôle au bord ne saurait de toute façon pas se passer du second :
 * il lit un cookie, et un cookie n'est pas une autorisation.
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

  // Ne PAS retirer cet appel : c'est lui qui déclenche le rafraîchissement
  // du jeton auprès de Supabase. Son résultat sert maintenant aussi au
  // refus ci-dessous, mais il serait nécessaire même sans lui.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  /* « PAS DE SESSION » EST UNE RÉPONSE ; TOUT LE RESTE EST UNE PANNE.
     `getUser()` renvoie `user: null` AUSSI quand il n'a pas pu joindre
     Supabase — la distinction a déjà coûté un défaut à ce projet, documenté
     dans `getSessionUser`. Ce refus au bord est né avec le même angle mort,
     et il l'aurait payé bien plus cher : une coupure passagère, l'ordinaire
     d'une connexion guinéenne, aurait DÉCONNECTÉ tout le monde en apparence.

     On ne refuse donc que sur un refus CERTAIN. En cas de panne on laisse
     passer : la page tentera sa propre lecture et sa frontière d'erreur
     dira « Pas de connexion », le message juste. Rien n'est ouvert pour
     autant — le layout de `(vendeur)` et le RLS refuseront l'un comme
     l'autre, en base, là où ça compte.

     CE QUE CE GARDE-FOU NE COUVRE PAS, à vérifier sur une vraie base : avec
     un jeton déjà EXPIRÉ et Supabase injoignable, le rafraîchissement
     échoue et `@supabase/ssr` efface la session de son côté. L'appel suivant
     reçoit alors un honnête « pas de session » et renvoie sur `/connexion`.
     Ça ne se corrige pas ici, et peut-être pas du tout : c'est la
     bibliothèque qui décide d'abandonner une session qu'elle n'a pas pu
     renouveler. */
  const panneAuth = Boolean(error) && !isAuthSessionMissingError(error!);

  const chemin = request.nextUrl.pathname;
  const espacePrive = ESPACES_AUTHENTIFIES.some((p) => chemin === p || chemin.startsWith(`${p}/`));

  if (espacePrive && !user && !panneAuth) {
    /* `?next=` porte la destination voulue jusqu'à l'écran de connexion,
       qui y renvoie une fois la session ouverte. C'est le paramètre que
       l'écran 16 utilise DÉJÀ (« Créez un compte pour écrire ») : on
       réemploie le mécanisme existant plutôt que d'en inventer un second
       qui ferait la même chose sous un autre nom, avec sa propre
       validation à tenir à jour.

       Il est filtré par `safeNextPath` avant tout usage (voir
       `src/lib/next-param.ts`) : un paramètre de redirection qui accepte
       une URL absolue est une redirection ouverte, c'est-à-dire un
       hameçonnage hébergé par nos soins. Ici on n'y met qu'un chemin
       interne, mais la garde reste du côté de qui le LIT — c'est la seule
       place où elle protège vraiment. */
    const connexion = request.nextUrl.clone();
    connexion.pathname = "/connexion";
    connexion.search = "";
    connexion.searchParams.set("next", chemin + request.nextUrl.search);
    return NextResponse.redirect(connexion);
  }

  return supabaseResponse;
}
