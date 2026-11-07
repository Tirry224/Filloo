import { notFound } from "next/navigation";
import { FilVue } from "@/components/admin/FilVue";
import { lireBoite, lireEspace } from "@/lib/data/equipe";
import { lireFiche } from "@/lib/data/gestion";
import { estUuid } from "@/lib/saisie";
import { createClient } from "@/lib/supabase/server";

/**
 * Le fil d'une personne avec l'équipe, présenté comme une conversation du
 * site (`ThreadScreen`) : l'équipe à droite, la personne à gauche. L'ouvrir
 * marque ses messages lus pour TOUTE l'équipe : un seul collègue suffit à
 * les prendre en charge. Chaque réponse porte, pour les collègues, le nom
 * de qui l'a écrite ; la personne, elle, ne voit que « Équipe Filloo ».
 *
 * Un fil encore VIDE s'ouvre aussi (2026-11-07 : l'équipe écrit en
 * premier), depuis une fiche ou la recherche des Messages : `?profil=`
 * désigne le compte, relu par `equipe_compte`, qui doit être cette
 * connexion, dans cet espace, et pas supprimé. Le RLS de 0042 laisse déjà
 * l'équipe écrire dans n'importe quel fil.
 */
export default async function FilPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; espace?: string; profil?: string }>;
}) {
  const { id } = await params;
  if (!estUuid(id)) notFound();
  const { erreur, espace: brut, profil } = await searchParams;
  // Le fil client ou le fil boutique de cette personne (0044).
  const espace = lireEspace(brut);

  const supabase = await createClient();
  const [{ data: messages, error }, { data: membres }, boite] = await Promise.all([
    supabase
      .from("fil_equipe")
      .select("id, auteur_id, de_l_equipe, corps, created_at, annonces(titre)")
      .eq("fil_de", id)
      .eq("espace", espace)
      .order("created_at"),
    supabase.from("equipe").select("auth_user_id, nom"),
    lireBoite(supabase),
  ]);
  if (error) throw error;
  const nomDe = new Map((membres ?? []).map((m) => [m.auth_user_id, m.nom]));

  if (!messages.length) {
    const fiche = estUuid(profil) ? await lireFiche(supabase, profil) : null;
    if (!fiche || fiche.auth_user_id !== id || fiche.role !== espace || fiche.is_deleted) notFound();
    const nom = (espace === "merchant" ? fiche.shop_name : null) ?? fiche.nom ?? "Utilisateur";
    return <FilVue id={id} espace={espace} nom={nom} messages={[]} nomDe={nomDe} erreur={erreur} profil={profil} />;
  }

  await supabase.rpc("marquer_fil_lu_par_l_equipe", { p_fil_de: id, p_espace: espace });
  const nom = boite.find((f) => f.filDe === id && f.espace === espace)?.nom ?? "Utilisateur";
  return <FilVue id={id} espace={espace} nom={nom} messages={messages} nomDe={nomDe} erreur={erreur} />;
}
