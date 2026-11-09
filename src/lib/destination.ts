import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { landingForSession } from "@/lib/data/session";
import { safeNextPath } from "@/lib/next-param";

/**
 * Où atterrir après s'être authentifié — connexion OU réinitialisation de
 * mot de passe. Jamais `/` en dur : `landingForSession` tranche
 * (décision 8 de SPEC), et `next` ne fait que CHOISIR une destination à
 * l'intérieur de l'espace autorisé, il ne défait pas la décision.
 */
export async function destinationApresAuthentification(
  supabase: SupabaseClient<Database>,
  brut: FormDataEntryValue | string | null,
): Promise<string> {
  const landing = await landingForSession(supabase);
  const next = safeNextPath(brut);
  const espaceCommercantSeul = landing === "/vendeur";
  const autorise =
    next && (!espaceCommercantSeul || next === "/vendeur" || next.startsWith("/vendeur/"));
  return autorise ? next : landing;
}

