import { redirect } from "next/navigation";
import { landingForSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

/* À la requête : la destination dépend de la session. */
export const dynamic = "force-dynamic";

/**
 * L'adresse que portent les notifications de l'équipe (0042) : elle
 * renvoie vers la page de l'espace où la personne se trouve.
 */
export default async function EquipeAiguillage() {
  const supabase = await createClient();
  const accueil = await landingForSession(supabase);
  redirect(accueil.startsWith("/vendeur") ? "/vendeur/equipe" : "/compte/equipe");
}
