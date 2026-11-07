"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOGUE } from "@/lib/data/catalogue-public";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMANDES_PUB_OUVERTES, DUREES, lireTypeCampagne } from "@/lib/data/publicite";
import { messagePourErreur } from "@/lib/erreurs";
import { estUuid, longueur, texteNettoye } from "@/lib/saisie";

/**
 * Les gestes de la publicité (0047). Écrits AVEC la session : c'est la base
 * qui vérifie que le produit est à la boutique de l'appelant, que la
 * boutique n'a pas trop de campagnes, et que seule l'équipe décide.
 */

const VENDEUR = "/vendeur/publicite";
const ADMIN = "/admin/publicite";

function retour(chemin: string, erreur?: string, info?: string): never {
  const params = new URLSearchParams();
  if (erreur) params.set("erreur", erreur);
  if (info) params.set("info", info);
  const q = params.toString();
  redirect(`${chemin}${q ? `?${q}` : ""}`);
}

function rafraichir(): void {
  // Les publicités sont lues une minute en cache (`data/publicite.ts`) : une décision se voit aussitôt.
  revalidateTag(CATALOGUE, { expire: 0 });
  revalidatePath(VENDEUR);
  revalidatePath(ADMIN);
  revalidatePath("/");
}

export async function demanderCampagneAction(formData: FormData): Promise<void> {
  // Fermé pour l'instant (`DEMANDES_PUB_OUVERTES`) : un formulaire resté ouvert dans un onglet ne passe pas non plus.
  if (!DEMANDES_PUB_OUVERTES) retour(VENDEUR, "Les demandes de publicité ne sont pas encore ouvertes.");
  const type = lireTypeCampagne(formData.get("type"));
  if (!type) retour(VENDEUR, "Choisissez un type de publicité.");
  const duree = Number(formData.get("duree"));
  if (!DUREES.includes(duree as (typeof DUREES)[number])) retour(VENDEUR, "Choisissez une durée.");
  const produit = formData.get("produit");
  if (type !== "boutique" && !estUuid(produit)) retour(VENDEUR, "Choisissez le produit à mettre en avant.");
  const supabase = await createClient();
  // La catégorie d'une promotion est celle du produit, relue ici : le formulaire n'a pas à la connaître.
  let categorie: number | null = null;
  if (type === "categorie") {
    const { data } = await supabase.from("products").select("category_id").eq("id", produit as string).maybeSingle();
    if (!data) retour(VENDEUR, "Ce produit n'existe plus.");
    categorie = data.category_id;
  }

  const { error } = await supabase.rpc("demander_campagne", {
    p_type: type,
    p_product: type === "boutique" ? undefined : (produit as string),
    p_category: categorie ?? undefined,
    p_duree: duree,
  });
  if (error) retour(VENDEUR, messagePourErreur(error, "publicité"));

  rafraichir();
  retour(VENDEUR, undefined, "Demande envoyée. L'équipe Filloo la valide avant sa mise en ligne.");
}

export async function annulerCampagneAction(formData: FormData): Promise<void> {
  const id = formData.get("campagne");
  if (!estUuid(id)) retour(VENDEUR, "Campagne introuvable.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("annuler_campagne", { p_id: id });
  if (error) retour(VENDEUR, messagePourErreur(error, "publicité"));
  rafraichir();
  retour(VENDEUR, undefined, "Campagne annulée.");
}

function lireMotif(formData: FormData, obligatoire: boolean): string | null {
  const motif = texteNettoye(formData.get("motif"));
  if (!motif && !obligatoire) return null;
  if (longueur(motif) < 3) retour(ADMIN, "Écrivez le motif, il sera montré au commerçant.");
  if (longueur(motif) > 500) retour(ADMIN, "Motif : 500 caractères au plus.");
  return motif;
}

export async function deciderCampagneAction(formData: FormData): Promise<void> {
  const id = formData.get("campagne");
  if (!estUuid(id)) retour(ADMIN, "Campagne introuvable.");
  const accepter = formData.get("decision") === "accepter";
  const motif = lireMotif(formData, !accepter);

  const supabase = await createClient();
  const { error } = await supabase.rpc("decider_campagne", { p_id: id, p_accepter: accepter, p_motif: motif ?? undefined });
  if (error) retour(ADMIN, messagePourErreur(error, "publicité"));
  rafraichir();
  retour(ADMIN, undefined, accepter ? "Campagne en ligne." : "Campagne refusée.");
}

export async function interrompreCampagneAction(formData: FormData): Promise<void> {
  const id = formData.get("campagne");
  if (!estUuid(id)) retour(ADMIN, "Campagne introuvable.");
  const motif = lireMotif(formData, true);

  const supabase = await createClient();
  const { error } = await supabase.rpc("interrompre_campagne", { p_id: id, p_motif: motif! });
  if (error) retour(ADMIN, messagePourErreur(error, "publicité"));
  rafraichir();
  retour(ADMIN, undefined, "Campagne interrompue.");
}
