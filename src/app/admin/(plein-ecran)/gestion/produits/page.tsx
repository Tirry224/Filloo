import { ProduitsVue } from "@/components/admin/GestionVue";
import { lireFiltreProduits, lireProduits, lireRecherche } from "@/lib/data/gestion";
import { createClient } from "@/lib/supabase/server";

/** Chercher un produit, le masquer ou le démasquer (0064). */
export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string; erreur?: string; info?: string }>;
}) {
  const { q, statut, erreur, info } = await searchParams;
  const recherche = lireRecherche(q);
  const filtre = lireFiltreProduits(statut);
  const supabase = await createClient();
  return (
    <ProduitsVue produits={await lireProduits(supabase, recherche, filtre)} recherche={recherche} filtre={filtre} erreur={erreur} info={info} />
  );
}
