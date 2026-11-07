import { notFound, redirect } from "next/navigation";
import { FicheVue } from "@/components/admin/GestionVue";
import { espaceDuRole, lireEspace, lireFiche, lireProduitsBoutique, lireRecherche } from "@/lib/data/gestion";
import { estUuid } from "@/lib/saisie";
import { createClient } from "@/lib/supabase/server";

/** La fiche d'un acheteur ou d'un vendeur : tout ce qu'on sait, et pour
 *  une boutique tous ses produits (0067). Le retour ramène à sa liste. */
export default async function FichePage({
  params,
  searchParams,
}: {
  params: Promise<{ espace: string; id: string }>;
  searchParams: Promise<{ q?: string; erreur?: string; info?: string }>;
}) {
  const { espace: brut, id } = await params;
  const espace = lireEspace(brut);
  if (!espace || !estUuid(id)) notFound();
  const { q, erreur, info } = await searchParams;
  const recherche = lireRecherche(q);
  const supabase = await createClient();
  const fiche = await lireFiche(supabase, id);
  if (!fiche) notFound();
  /* Un lien vers le mauvais espace (un client ouvert sous /vendeurs) va au bon. */
  const bon = espaceDuRole(fiche.role);
  if (bon !== espace) redirect(`/admin/gestion/${bon}/${id}${recherche ? `?q=${encodeURIComponent(recherche)}` : ""}`);
  const produits = fiche.merchant_id ? await lireProduitsBoutique(supabase, fiche.merchant_id) : [];
  return <FicheVue espace={espace} fiche={fiche} produits={produits} recherche={recherche} erreur={erreur} info={info} />;
}
