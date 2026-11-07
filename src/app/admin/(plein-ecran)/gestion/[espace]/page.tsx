import { notFound } from "next/navigation";
import { ComptesVue } from "@/components/admin/GestionVue";
import { lireComptes, lireEspace, lireRecherche } from "@/lib/data/gestion";
import { createClient } from "@/lib/supabase/server";

/** `/admin/gestion/vendeurs` et `/admin/gestion/acheteurs` : chaque espace a sa liste (0067). */
export default async function EspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ espace: string }>;
  searchParams: Promise<{ q?: string; erreur?: string; info?: string }>;
}) {
  const espace = lireEspace((await params).espace);
  if (!espace) notFound();
  const { q, erreur, info } = await searchParams;
  const recherche = lireRecherche(q);
  const supabase = await createClient();
  return (
    <ComptesVue espace={espace} comptes={await lireComptes(supabase, recherche, espace)} recherche={recherche} erreur={erreur} info={info} />
  );
}
