"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/data/session";
import { DUREES, MOYENS_MOBILES, lireMoyen, lireTypeCampagne, type MoyenMobile } from "@/lib/data/publicite";
import { messagePourErreur } from "@/lib/erreurs";
import { formatGnf } from "@/lib/format";
import { informerDeLaCampagne } from "@/lib/notifications-publicite";
import { estUuid, longueur, texteNettoye } from "@/lib/saisie";
import { estTelephone, nettoyerTelephone } from "@/lib/telephone";

/**
 * Les gestes de la publicité (0047). Écrits AVEC la session : c'est la base
 * qui vérifie que le produit est à la boutique de l'appelant, que la
 * boutique n'a pas trop de campagnes, et que seule l'équipe décide.
 */

const VENDEUR = "/vendeur/publicite";
const ADMIN = "/admin/publicite";
const ADMIN_TARIFS = "/admin/publicite/tarifs";
const ADMIN_NOUVELLE = "/admin/publicite/nouvelle";

const dateLongue = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Conakry" }) : "";

function retour(chemin: string, erreur?: string, info?: string): never {
  const params = new URLSearchParams();
  if (erreur) params.set("erreur", erreur);
  if (info) params.set("info", info);
  const q = params.toString();
  redirect(`${chemin}${q ? `?${q}` : ""}`);
}

function rafraichir(): void {
  revalidatePath(VENDEUR);
  revalidatePath(ADMIN);
  revalidatePath("/");
}

/** Le membre de l'équipe qui agit : il signe le message envoyé au commerçant. */
async function membre() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/connexion");
  return { supabase, userId: user.id };
}

export async function demanderCampagneAction(formData: FormData): Promise<void> {
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
  retour(VENDEUR, undefined, "Demande enregistrée. Payez puis indiquez la référence du paiement ci-dessous.");
}

/** Le commerçant a payé hors de Filloo : il donne de quoi retrouver le paiement. */
export async function declarerPaiementAction(formData: FormData): Promise<void> {
  const id = formData.get("campagne");
  if (!estUuid(id)) retour(VENDEUR, "Campagne introuvable.");
  const moyen = lireMoyen(formData.get("moyen"));
  if (!moyen || !MOYENS_MOBILES.includes(moyen as MoyenMobile)) retour(VENDEUR, "Choisissez Orange Money ou MTN MoMo.");
  const reference = texteNettoye(formData.get("reference"));
  if (longueur(reference) < 3 || longueur(reference) > 60) retour(VENDEUR, "Recopiez la référence du paiement (reçue par SMS).");
  const numero = nettoyerTelephone(texteNettoye(formData.get("numero")));
  if (!estTelephone(numero)) retour(VENDEUR, "Indiquez le numéro qui a payé.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("declarer_paiement", { p_id: id, p_moyen: moyen, p_reference: reference, p_numero: numero });
  if (error) retour(VENDEUR, messagePourErreur(error, "publicité"));
  rafraichir();
  retour(VENDEUR, undefined, "Paiement déclaré. L'équipe Filloo le vérifie, puis met votre publicité en ligne.");
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

  const { supabase, userId } = await membre();
  const { error } = await supabase.rpc("decider_campagne", { p_id: id, p_accepter: accepter, p_motif: motif ?? undefined });
  if (error) retour(ADMIN, messagePourErreur(error, "publicité"));
  after(() =>
    informerDeLaCampagne(supabase, userId, id, (c) =>
      accepter
        ? `Votre publicité pour ${c.cible} est en ligne jusqu'au ${dateLongue(c.finAt)}.` +
          (c.prixGnf ? ` Paiement de ${formatGnf(c.prixGnf)} bien reçu, merci.` : "")
        : `Votre demande de publicité pour ${c.cible} est refusée. Motif : ${motif}` +
          (c.prixGnf ? ` Si vous l'avez déjà payée, l'équipe vous rembourse ${formatGnf(c.prixGnf)}.` : ""),
    ),
  );
  rafraichir();
  retour(ADMIN, undefined, accepter ? "Campagne en ligne." : "Campagne refusée.");
}

export async function interrompreCampagneAction(formData: FormData): Promise<void> {
  const id = formData.get("campagne");
  if (!estUuid(id)) retour(ADMIN, "Campagne introuvable.");
  const motif = lireMotif(formData, true);

  const { supabase, userId } = await membre();
  const { error } = await supabase.rpc("interrompre_campagne", { p_id: id, p_motif: motif! });
  if (error) retour(ADMIN, messagePourErreur(error, "publicité"));
  after(() =>
    informerDeLaCampagne(supabase, userId, id, (c) => `Votre publicité pour ${c.cible} a été interrompue. Motif : ${motif}`),
  );
  rafraichir();
  retour(ADMIN, undefined, "Campagne interrompue.");
}

export async function marquerRembourseAction(formData: FormData): Promise<void> {
  const id = formData.get("campagne");
  if (!estUuid(id)) retour(ADMIN, "Campagne introuvable.");
  const { supabase, userId } = await membre();
  const { error } = await supabase.rpc("marquer_rembourse", { p_id: id });
  if (error) retour(ADMIN, messagePourErreur(error, "publicité"));
  after(() =>
    informerDeLaCampagne(
      supabase,
      userId,
      id,
      (c) => `L'équipe Filloo vous a remboursé ${c.prixGnf ? formatGnf(c.prixGnf) : "votre paiement"} pour la publicité de ${c.cible}.`,
    ),
  );
  rafraichir();
  retour(ADMIN, undefined, "Remboursement noté.");
}

/** L'équipe met elle-même une publicité en ligne : payée en main propre, par mobile, ou offerte. */
export async function creerCampagneEquipeAction(formData: FormData): Promise<void> {
  const boutique = formData.get("boutique");
  if (!estUuid(boutique)) retour(ADMIN_NOUVELLE, "Choisissez une boutique.");
  const ici = `${ADMIN_NOUVELLE}?boutique=${boutique}`;
  const type = lireTypeCampagne(formData.get("type"));
  if (!type) retour(ici, "Choisissez un type de publicité.");
  const duree = Number(formData.get("duree"));
  if (!DUREES.includes(duree as (typeof DUREES)[number])) retour(ici, "Choisissez une durée.");
  const moyen = lireMoyen(formData.get("moyen"));
  if (!moyen) retour(ici, "Indiquez comment elle a été payée, ou « Offert ».");
  const reference = texteNettoye(formData.get("reference"));
  if (reference && (longueur(reference) < 3 || longueur(reference) > 60)) retour(ici, "Référence : de 3 à 60 caractères.");
  const produit = formData.get("produit");
  if (type !== "boutique" && !estUuid(produit)) retour(ici, "Choisissez le produit.");

  const { supabase, userId } = await membre();
  let categorie: number | null = null;
  if (type === "categorie") {
    const { data } = await supabase.from("products").select("category_id").eq("id", produit as string).maybeSingle();
    if (!data) retour(ici, "Ce produit n'existe plus.");
    categorie = data.category_id;
  }
  const { data: id, error } = await supabase.rpc("creer_campagne_equipe", {
    p_merchant: boutique,
    p_type: type,
    p_product: type === "boutique" ? undefined : (produit as string),
    p_category: categorie ?? undefined,
    p_duree: duree,
    p_moyen: moyen,
    p_reference: reference || undefined,
  });
  if (error || !id) retour(ici, error ? messagePourErreur(error, "publicité") : "Campagne non créée.");
  after(() =>
    informerDeLaCampagne(
      supabase,
      userId,
      id,
      (c) => `L'équipe Filloo a mis en ligne une publicité pour ${c.cible}, jusqu'au ${dateLongue(c.finAt)}.`,
    ),
  );
  rafraichir();
  retour(ADMIN, undefined, "Campagne en ligne.");
}

/** La grille des prix : un champ par type et par durée ; seuls les prix changés partent en base. */
export async function fixerTarifsAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  let changes = 0;
  for (const [cle, valeur] of formData.entries()) {
    const m = /^prix:(produit|categorie|boutique):(\d+)$/.exec(cle);
    if (!m || typeof valeur !== "string") continue;
    const ancien = formData.get(`ancien:${m[1]}:${m[2]}`);
    const brut = valeur.replace(/\D/g, "");
    if (brut === "" || brut === String(ancien ?? "").replace(/\D/g, "")) continue;
    const prix = Number(brut);
    if (!Number.isSafeInteger(prix) || prix > 100_000_000) retour(ADMIN_TARIFS, "Un prix va de 0 à 100 000 000 GNF.");
    const { error } = await supabase.rpc("fixer_tarif", { p_type: m[1], p_duree: Number(m[2]), p_prix: prix });
    if (error) retour(ADMIN_TARIFS, messagePourErreur(error, "tarif"));
    changes++;
  }
  revalidatePath(ADMIN_TARIFS);
  revalidatePath(VENDEUR);
  retour(ADMIN_TARIFS, undefined, changes ? `${changes} prix modifié${changes > 1 ? "s" : ""}.` : "Aucun prix changé.");
}

/** Le numéro officiel où les commerçants envoient leur paiement. */
export async function fixerMoyenPaiementAction(formData: FormData): Promise<void> {
  const moyen = lireMoyen(formData.get("moyen"));
  if (!moyen || !MOYENS_MOBILES.includes(moyen as MoyenMobile)) retour(ADMIN_TARIFS, "Moyen de paiement inconnu.");
  const numero = nettoyerTelephone(texteNettoye(formData.get("numero")));
  if (!estTelephone(numero)) retour(ADMIN_TARIFS, "Numéro de paiement invalide.");
  const titulaire = texteNettoye(formData.get("titulaire"));
  if (longueur(titulaire) < 2 || longueur(titulaire) > 80) retour(ADMIN_TARIFS, "Indiquez le nom du titulaire du compte.");
  const actif = formData.get("actif") === "on";

  const supabase = await createClient();
  const { error } = await supabase.rpc("fixer_moyen_paiement", { p_moyen: moyen, p_numero: numero, p_titulaire: titulaire, p_actif: actif });
  if (error) retour(ADMIN_TARIFS, messagePourErreur(error, "paiement"));
  revalidatePath(ADMIN_TARIFS);
  revalidatePath(VENDEUR);
  retour(ADMIN_TARIFS, undefined, "Numéro enregistré.");
}
