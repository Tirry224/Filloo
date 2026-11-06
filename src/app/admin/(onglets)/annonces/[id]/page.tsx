import { notFound } from "next/navigation";
import { AnnonceAdminVue } from "@/components/admin/AnnonceAdminVue";
import { lireAnnonceAdmin } from "@/lib/data/equipe";
import { estUuid } from "@/lib/saisie";
import { createClient } from "@/lib/supabase/server";

/** Une annonce : la modifier, la publier, la programmer, la retirer, et voir qui l'a lue (0045). */
export default async function AnnoncePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; info?: string; lecteurs?: string }>;
}) {
  const { id } = await params;
  if (!estUuid(id)) notFound();
  const { erreur, info, lecteurs: onglet } = await searchParams;
  const supabase = await createClient();
  const lu = await lireAnnonceAdmin(supabase, id);
  if (!lu) notFound();
  return (
    <AnnonceAdminVue
      annonce={lu.annonce}
      lecteurs={lu.lecteurs}
      erreur={erreur}
      info={info}
      onglet={onglet === "non" ? "non" : "oui"}
    />
  );
}
