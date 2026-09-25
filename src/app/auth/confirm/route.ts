import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/next-param";

/** Les seuls types de lien email que `/auth/confirm` accepte par
 * `token_hash`. */
const TYPES_ACCEPTES = new Set<EmailOtpType>(["recovery", "signup", "email"]);

/**
 * L'échange code → session doit se faire dans un Route Handler (seul
 * endroit où `next/headers` peut vraiment écrire des cookies) — un
 * composant serveur ne le peut pas.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  /* `next` vient du lien reçu par email, donc d'une URL réécrivable par
     quiconque la fait suivre. Recollé tel quel à `origin`, il ouvre une
     redirection vers un tiers : `?next=@exemple.gn` donne
     `https://filloo…@exemple.gn`, dont le vrai domaine est `exemple.gn`.

     Même liste blanche que les écrans d'authentification
     (`safeNextPath`) : un chemin interne, ou le défaut. */
  const next = safeNextPath(searchParams.get("next")) ?? "/reinitialiser-mot-de-passe";

  /* LE JETON DANS LE LIEN (`token_hash`), voie normale depuis le
     2026-09-25. Le lien porte à lui seul la preuve : il marche quel que
     soit le navigateur qui l'ouvre.

     L'ancienne voie (`code`, ci-dessous) exige une clé secrète déposée
     en cookie au moment de la DEMANDE, dans le même navigateur. Elle
     échouait en vrai (« code challenge does not match previously saved
     code verifier ») : l'app installée sur l'écran d'accueil et Safari,
     où l'app Mail ouvre les liens, n'ont pas les mêmes cookies ; et
     chaque nouvelle demande remplace la clé, ce qui tue le lien du mail
     précédent. Elle reste pour les liens déjà envoyés et tant que le
     modèle d'email Supabase n'est pas passé au `token_hash`
     (docs/MEMOIRE.md). */
  if (tokenHash && type && TYPES_ACCEPTES.has(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/confirm] verifyOtp a échoué :", error.message);
  } else if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/confirm] exchangeCodeForSession a échoué :", error.message);
  }

  return NextResponse.redirect(`${origin}/mot-de-passe-oublie?erreur=lien_invalide`);
}
