"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lireFormulePayante } from "@/lib/data/abonnements";
import { lirePack } from "@/lib/data/credits";
import { MOYENS_MOBILES, lireMoyen, type MoyenMobile } from "@/lib/data/publicite";
import { messagePourErreur } from "@/lib/erreurs";
import { estUuid, longueur, texteNettoye } from "@/lib/saisie";
import { estTelephone, nettoyerTelephone } from "@/lib/telephone";

/**
 * Les gestes des crédits de publicité (0050). La base tient le solde : le
 * site ne calcule jamais ce qu'il reste, il le demande.
 */

const VENDEUR = "/vendeur/credits";
const PUBLICITE = "/vendeur/publicite";
const ADMIN = "/admin/credits";
const ADMIN_TARIFS = "/admin/publicite/tarifs";

function retour(chemin: string, erreur?: string, info?: string): never {
  const params = new URLSearchParams();
  if (erreur) params.set("erreur", erreur);
  if (info) params.set("info", info);
  const q = params.toString();
  redirect(`${chemin}${q ? `?${q}` : ""}`);
}

function rafraichir(): void {
  revalidatePath(VENDEUR);
  revalidatePath(PUBLICITE);
  revalidatePath(ADMIN);
  revalidatePath("/admin/publicite");
}

export async function demanderCreditsAction(formData: FormData): Promise<void> {
  const pack = lirePack(formData.get("pack"));
  if (!pack) retour(VENDEUR, "Choisissez un pack de 10, 25 ou 50 crédits.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("demander_credits", { p_credits: pack });
  if (error) retour(VENDEUR, messagePourErreur(error, "crédits"));
  rafraichir();
  retour(VENDEUR, undefined, "Demande enregistrée. Payez puis indiquez la référence du paiement.");
}

export async function declarerPaiementCreditsAction(formData: FormData): Promise<void> {
  const id = formData.get("achat");
  if (!estUuid(id)) retour(VENDEUR, "Achat introuvable.");
  const moyen = lireMoyen(formData.get("moyen"));
  if (!moyen || !MOYENS_MOBILES.includes(moyen as MoyenMobile)) retour(VENDEUR, "Choisissez Orange Money ou MTN MoMo.");
  const reference = texteNettoye(formData.get("reference"));
  if (longueur(reference) < 3 || longueur(reference) > 60) retour(VENDEUR, "Recopiez la référence du paiement (reçue par SMS).");
  const numero = nettoyerTelephone(texteNettoye(formData.get("numero")));
  if (!estTelephone(numero)) retour(VENDEUR, "Indiquez le numéro qui a payé.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("declarer_paiement_credits", { p_id: id, p_moyen: moyen, p_reference: reference, p_numero: numero });
  if (error) retour(VENDEUR, messagePourErreur(error, "crédits"));
  rafraichir();
  retour(VENDEUR, undefined, "Paiement déclaré. Vos crédits arrivent dès que l'équipe l'a vérifié.");
}

export async function annulerAchatCreditsAction(formData: FormData): Promise<void> {
  const id = formData.get("achat");
  if (!estUuid(id)) retour(VENDEUR, "Achat introuvable.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("annuler_achat_credits", { p_id: id });
  if (error) retour(VENDEUR, messagePourErreur(error, "crédits"));
  rafraichir();
  retour(VENDEUR, undefined, "Demande annulée.");
}

/** Le commerçant paie sa publicité avec ses crédits : plus rien à vérifier côté argent, l'équipe juge seulement le contenu. */
export async function payerCampagneEnCreditsAction(formData: FormData): Promise<void> {
  const id = formData.get("campagne");
  if (!estUuid(id)) retour(PUBLICITE, "Campagne introuvable.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("payer_campagne_en_credits", { p_id: id });
  if (error) retour(PUBLICITE, messagePourErreur(error, "crédits"));
  rafraichir();
  retour(PUBLICITE, undefined, "Payée avec vos crédits. L'équipe Filloo la vérifie avant sa mise en ligne.");
}

function lireMotif(formData: FormData, obligatoire: boolean): string | null {
  const motif = texteNettoye(formData.get("motif"));
  if (!motif && !obligatoire) return null;
  if (longueur(motif) < 3) retour(ADMIN, "Écrivez le motif, il sera montré au commerçant.");
  if (longueur(motif) > 500) retour(ADMIN, "Motif : 500 caractères au plus.");
  return motif;
}

export async function deciderAchatCreditsAction(formData: FormData): Promise<void> {
  const id = formData.get("achat");
  if (!estUuid(id)) retour(ADMIN, "Achat introuvable.");
  const accepter = formData.get("decision") === "accepter";
  const motif = lireMotif(formData, !accepter);
  const supabase = await createClient();
  const { error } = await supabase.rpc("decider_achat_credits", { p_id: id, p_accepter: accepter, p_motif: motif ?? undefined });
  if (error) retour(ADMIN, messagePourErreur(error, "crédits"));
  rafraichir();
  retour(ADMIN, undefined, accepter ? "Crédits ajoutés." : "Achat refusé.");
}

export async function marquerAchatCreditsRembourseAction(formData: FormData): Promise<void> {
  const id = formData.get("achat");
  if (!estUuid(id)) retour(ADMIN, "Achat introuvable.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("marquer_achat_credits_rembourse", { p_id: id });
  if (error) retour(ADMIN, messagePourErreur(error, "crédits"));
  rafraichir();
  retour(ADMIN, undefined, "Remboursement noté.");
}

/** Offrir (nombre positif) ou retirer (négatif) des crédits, toujours avec un motif signé dans l'historique. */
export async function corrigerCreditsAction(formData: FormData): Promise<void> {
  const boutique = formData.get("boutique");
  if (!estUuid(boutique)) retour(ADMIN, "Choisissez une boutique.");
  const n = Number(String(formData.get("credits") ?? "").replace(/\s/g, ""));
  if (!Number.isSafeInteger(n) || n === 0 || Math.abs(n) > 10_000) retour(ADMIN, "Indiquez un nombre de crédits, négatif pour en retirer.");
  const motif = lireMotif(formData, true)!;
  const supabase = await createClient();
  const { error } = await supabase.rpc("corriger_credits", { p_merchant: boutique, p_credits: n, p_motif: motif });
  if (error) retour(ADMIN, messagePourErreur(error, "crédits"));
  rafraichir();
  retour(ADMIN, undefined, n > 0 ? `${n} crédits offerts.` : `${-n} crédits retirés.`);
}

export async function fixerCreditsInclusAction(formData: FormData): Promise<void> {
  const formule = lireFormulePayante(formData.get("formule"));
  if (!formule) retour(ADMIN_TARIFS, "Formule inconnue.");
  const n = Number(String(formData.get("credits") ?? "").replace(/\D/g, ""));
  if (!Number.isSafeInteger(n) || n > 1000) retour(ADMIN_TARIFS, "De 0 à 1 000 crédits par mois.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("fixer_credits_inclus", { p_formule: formule, p_credits: n });
  if (error) retour(ADMIN_TARIFS, messagePourErreur(error, "crédits"));
  revalidatePath(ADMIN_TARIFS);
  revalidatePath("/vendeur/abonnement");
  retour(ADMIN_TARIFS, undefined, "Crédits inclus enregistrés.");
}
