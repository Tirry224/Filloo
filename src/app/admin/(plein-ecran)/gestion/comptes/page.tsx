import { ComptesVue } from "@/components/admin/GestionVue";
import { lireComptes, lireRecherche } from "@/lib/data/gestion";
import { createClient } from "@/lib/supabase/server";

/** Chercher un client ou une boutique, le suspendre ou le réactiver (0063). */
export default async function ComptesPage({ searchParams }: { searchParams: Promise<{ q?: string; erreur?: string; info?: string }> }) {
  const { q, erreur, info } = await searchParams;
  const recherche = lireRecherche(q);
  const supabase = await createClient();
  return <ComptesVue comptes={await lireComptes(supabase, recherche)} recherche={recherche} erreur={erreur} info={info} />;
}
