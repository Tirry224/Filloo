import { createAdminClient } from "@/lib/supabase/admin";

/** L'API de stockage accepte une liste ; on l'envoie par paquets pour
 * qu'un refus n'emporte pas tout le balayage. */
const PAQUET = 100;

export type RapportMenage = { orphelines: number; effacees: number; echecs: number };

/**
 * Efface les photos que plus aucun produit ne référence depuis 24 heures
 * — formulaires abandonnés, pour l'essentiel. La base les DÉSIGNE
 * (`photos_orphelines`, 0028) ; l'effacement passe par l'API de stockage,
 * la seule qui supprime le fichier et pas seulement sa ligne.
 */
export async function nettoyerPhotosOrphelines(): Promise<RapportMenage> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("photos_orphelines");
  if (error) throw new Error(`photos_orphelines : ${error.message}`);

  const chemins = data ?? [];
  let effacees = 0;
  let echecs = 0;
  for (let i = 0; i < chemins.length; i += PAQUET) {
    const paquet = chemins.slice(i, i + PAQUET);
    const { data: parties, error: erreurStockage } = await admin.storage.from("product-images").remove(paquet);
    if (erreurStockage) {
      console.error("[ménage] paquet de photos non effacé :", erreurStockage.message);
      echecs += paquet.length;
    } else {
      effacees += parties?.length ?? 0;
    }
  }
  return { orphelines: chemins.length, effacees, echecs };
}
