import { notFound } from "next/navigation";
import { FilVue } from "@/components/admin/FilVue";
import { lireBoite } from "@/lib/data/equipe";
import { estUuid } from "@/lib/saisie";
import { createClient } from "@/lib/supabase/server";

/**
 * Le fil d'une personne avec l'équipe, présenté comme une conversation du
 * site (`ThreadScreen`) : l'équipe à droite, la personne à gauche. L'ouvrir
 * marque ses messages lus pour TOUTE l'équipe : un seul collègue suffit à
 * les prendre en charge. Chaque réponse porte, pour les collègues, le nom
 * de qui l'a écrite ; la personne, elle, ne voit que « Équipe Filloo ».
 */
export default async function FilPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { id } = await params;
  if (!estUuid(id)) notFound();
  const { erreur } = await searchParams;

  const supabase = await createClient();
  const [{ data: messages, error }, { data: membres }, boite] = await Promise.all([
    supabase
      .from("fil_equipe")
      .select("id, auteur_id, de_l_equipe, corps, created_at, annonces(titre)")
      .eq("fil_de", id)
      .order("created_at"),
    supabase.from("equipe").select("auth_user_id, nom"),
    lireBoite(supabase),
  ]);
  if (error) throw error;
  if (!messages.length) notFound();
  await supabase.rpc("marquer_fil_lu_par_l_equipe", { p_fil_de: id });

  const nomDe = new Map((membres ?? []).map((m) => [m.auth_user_id, m.nom]));
  const nom = boite.find((f) => f.filDe === id)?.nom ?? "Utilisateur";
  return <FilVue id={id} nom={nom} messages={messages} nomDe={nomDe} erreur={erreur} />;
}
