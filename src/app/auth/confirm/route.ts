import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/next-param";

/**
 * Route technique, absente de docs/ECRANS.md : le lien envoyé par
 * `resetPasswordForEmail` pointe ici avec un `code` PKCE. L'échange
 * code → session doit se faire dans un Route Handler (seul endroit où
 * `next/headers` peut vraiment écrire des cookies) — un composant serveur
 * ne le peut pas, voir le commentaire de `createClient` dans
 * `src/lib/supabase/server.ts`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  /* `next` vient du lien reçu par email, donc d'une URL réécrivable par
     quiconque la fait suivre. Recollé tel quel à `origin`, il ouvre une
     redirection vers un tiers : `?next=@exemple.gn` donne
     `https://makiti…@exemple.gn`, dont le vrai domaine est `exemple.gn`.

     Même liste blanche que les écrans d'authentification
     (`safeNextPath`) : un chemin interne, ou le défaut. */
  const next = safeNextPath(searchParams.get("next")) ?? "/reinitialiser-mot-de-passe";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/mot-de-passe-oublie?erreur=lien_invalide`);
}
