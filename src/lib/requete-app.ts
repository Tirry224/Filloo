import { NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { passwordIsValid } from "@/lib/supabase/verify";

/**
 * Les deux preuves qu'exige une écriture protégée venue de l'APP MOBILE,
 * comme `/api/app/supprimer-compte` : le jeton Supabase
 * (`Authorization: Bearer`), vérifié par Supabase, dit QUI demande ; le
 * mot de passe, revérifié ici, dit que ce n'est pas un téléphone resté
 * déverrouillé. L'identifiant retenu est celui du jeton, jamais une
 * valeur envoyée par l'app.
 *
 * Rend la personne et le corps lu, ou la réponse d'erreur à renvoyer
 * telle quelle (401 jeton, 400 corps, 403 mot de passe).
 */
export async function verifierJetonEtMotDePasse(
  request: Request,
): Promise<{ user: User; corps: Record<string, unknown> } | NextResponse> {
  const jeton = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!jeton) return NextResponse.json({ erreur: "jeton absent" }, { status: 401 });

  let corps: Record<string, unknown>;
  try {
    const lu: unknown = await request.json();
    if (!lu || typeof lu !== "object") throw new Error("corps");
    corps = lu as Record<string, unknown>;
  } catch {
    return NextResponse.json({ erreur: "corps illisible" }, { status: 400 });
  }
  const motDePasse = typeof corps.motDePasse === "string" ? corps.motDePasse : "";
  if (!motDePasse) return NextResponse.json({ erreur: "mot de passe absent" }, { status: 400 });

  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(jeton);
  const user = data?.user;
  if (error || !user) return NextResponse.json({ erreur: "jeton refusé" }, { status: 401 });

  if (!user.email || !(await passwordIsValid(user.email, motDePasse))) {
    return NextResponse.json({ erreur: "mot de passe incorrect" }, { status: 403 });
  }
  return { user, corps };
}
