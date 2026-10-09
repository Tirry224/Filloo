import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { anonymiserEtBannir } from "@/lib/suppression-compte";
import { passwordIsValid } from "@/lib/supabase/verify";

/**
 * « Supprimer mon compte » depuis l'APP MOBILE : même effacement que
 * `deleteAccountAction` du site, qui exige la clé `service_role` que
 * l'app n'a pas (et ne doit jamais avoir).
 *
 * Deux preuves, comme sur le site : le jeton Supabase de l'app
 * (`Authorization: Bearer`), vérifié par Supabase, dit QUI demande ; le
 * mot de passe, revérifié ici, dit que ce n'est pas un téléphone resté
 * déverrouillé. L'identifiant effacé est celui du jeton, jamais une
 * valeur envoyée par l'app.
 */
export async function POST(request: Request) {
  const jeton = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!jeton) return NextResponse.json({ erreur: "jeton absent" }, { status: 401 });

  let corps: { motDePasse?: unknown };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "corps illisible" }, { status: 400 });
  }
  const motDePasse = typeof corps?.motDePasse === "string" ? corps.motDePasse : "";
  if (!motDePasse) return NextResponse.json({ erreur: "mot de passe absent" }, { status: 400 });

  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: utilisateur, error: erreurJeton } = await supabase.auth.getUser(jeton);
  const user = utilisateur?.user;
  if (erreurJeton || !user) return NextResponse.json({ erreur: "jeton refusé" }, { status: 401 });

  if (!user.email || !(await passwordIsValid(user.email, motDePasse))) {
    return NextResponse.json({ erreur: "mot de passe incorrect" }, { status: 403 });
  }

  try {
    await anonymiserEtBannir(user.id);
  } catch (erreur) {
    console.error("[suppression app] compte non supprimé :", erreur instanceof Error ? erreur.message : erreur);
    return NextResponse.json({ erreur: "suppression non aboutie" }, { status: 500 });
  }
  return NextResponse.json({ supprime: true });
}
