import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { anonymiserEtBannir, supprimerProfil } from "@/lib/suppression-compte";
import { refusMotDePasse } from "@/lib/supabase/verify";

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
 *
 * Corps : `{ motDePasse, role? }`. Avec `role` (`"client"` ou
 * `"merchant"`), seul ce compte est supprimé et l'autre reste, comme sur
 * le site depuis le 2026-10-23 ; la réponse dit alors si la connexion a
 * été fermée (`connexionFermee`). SANS `role` — l'app déjà installée —
 * tout est supprimé, comme avant : son comportement ne change pas.
 */
export async function POST(request: Request) {
  const jeton = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!jeton) return NextResponse.json({ erreur: "jeton absent" }, { status: 401 });

  let corps: { motDePasse?: unknown; role?: unknown };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "corps illisible" }, { status: 400 });
  }
  const motDePasse = typeof corps?.motDePasse === "string" ? corps.motDePasse : "";
  if (!motDePasse) return NextResponse.json({ erreur: "mot de passe absent" }, { status: 400 });
  const role = corps?.role;
  if (role !== undefined && role !== "client" && role !== "merchant") {
    return NextResponse.json({ erreur: "rôle inconnu" }, { status: 400 });
  }

  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: utilisateur, error: erreurJeton } = await supabase.auth.getUser(jeton);
  const user = utilisateur?.user;
  if (erreurJeton || !user) return NextResponse.json({ erreur: "jeton refusé" }, { status: 401 });

  /* 403 seulement si c'est le mot de passe : l'app installée affiche
     « mot de passe incorrect » sur un 403. Trop d'essais (429) ou panne
     (503) portent un `message` à afficher tel quel. */
  const refus = user.email ? await refusMotDePasse(user.email, motDePasse) : { incorrect: true, trop: false, message: "" };
  if (refus) {
    if (refus.incorrect) return NextResponse.json({ erreur: "mot de passe incorrect" }, { status: 403 });
    return NextResponse.json({ erreur: "vérification impossible", message: refus.message }, { status: refus.trop ? 429 : 503 });
  }

  try {
    if (role === undefined) {
      await anonymiserEtBannir(user.id);
      return NextResponse.json({ supprime: true });
    }
    const { connexionFermee } = await supprimerProfil(user.id, role);
    return NextResponse.json({ supprime: true, connexionFermee });
  } catch (erreur) {
    console.error("[suppression app] compte non supprimé :", erreur instanceof Error ? erreur.message : erreur);
    return NextResponse.json({ erreur: "suppression non aboutie" }, { status: 500 });
  }
}
