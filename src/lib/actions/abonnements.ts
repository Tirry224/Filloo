"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/data/session";
import { lireFormulePayante, type FormulePayante } from "@/lib/data/abonnements";
import { MOYENS_MOBILES, lireMoyen, type MoyenMobile } from "@/lib/data/publicite";
import { messagePourErreur } from "@/lib/erreurs";
import { formatGnf } from "@/lib/format";
import { informerDeLAbonnement } from "@/lib/notifications-publicite";
import { estUuid, longueur, texteNettoye } from "@/lib/saisie";
import { estTelephone, nettoyerTelephone } from "@/lib/telephone";

/**
 * Les gestes des abonnements (0049). Écrits AVEC la session : la base
 * vérifie la boutique, le paiement, et que seule l'équipe décide.
 */

const VENDEUR = "/vendeur/abonnement";
const ADMIN = "/admin/abonnements";
const ADMIN_TARIFS = "/admin/publicite/tarifs";

const dateLongue = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Conakry" }) : "";

function retour(chemin: string, erreur?: string, info?: string): never {
  const params = new URLSearchParams();
  if (erreur) params.set("erreur", erreur);
  if (info) params.set("info", info);
  const q = params.toString();
  redirect(`${chemin}${q ? `${chemin.includes("?") ? "&" : "?"}${q}` : ""}`);
}

function rafraichir(): void {
  revalidatePath(VENDEUR);
  revalidatePath(ADMIN);
  revalidatePath("/vendeur");
  revalidatePath("/vendeur/produits");
  revalidatePath("/");
}

async function membre() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/connexion");
  return { supabase, userId: user.id };
}

export async function demanderAbonnementAction(formData: FormData): Promise<void> {
  const formule = lireFormulePayante(formData.get("formule"));
  if (!formule) retour(VENDEUR, "Choisissez Pro ou Business.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("demander_abonnement", { p_formule: formule });
  if (error) retour(VENDEUR, messagePourErreur(error, "abonnement"));
  rafraichir();
  retour(VENDEUR, undefined, "Demande enregistrée. Payez puis indiquez la référence du paiement.");
}

export async function declarerPaiementAbonnementAction(formData: FormData): Promise<void> {
  const id = formData.get("abonnement");
  if (!estUuid(id)) retour(VENDEUR, "Abonnement introuvable.");
  const moyen = lireMoyen(formData.get("moyen"));
  if (!moyen || !MOYENS_MOBILES.includes(moyen as MoyenMobile)) retour(VENDEUR, "Choisissez Orange Money ou MTN MoMo.");
  const reference = texteNettoye(formData.get("reference"));
  if (longueur(reference) < 3 || longueur(reference) > 60) retour(VENDEUR, "Recopiez la référence du paiement (reçue par SMS).");
  const numero = nettoyerTelephone(texteNettoye(formData.get("numero")));
  if (!estTelephone(numero)) retour(VENDEUR, "Indiquez le numéro qui a payé.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("declarer_paiement_abonnement", {
    p_id: id,
    p_moyen: moyen,
    p_reference: reference,
    p_numero: numero,
  });
  if (error) retour(VENDEUR, messagePourErreur(error, "abonnement"));
  rafraichir();
  retour(VENDEUR, undefined, "Paiement déclaré. L'équipe Filloo le vérifie, puis active votre abonnement.");
}

export async function annulerAbonnementAction(formData: FormData): Promise<void> {
  const id = formData.get("abonnement");
  if (!estUuid(id)) retour(VENDEUR, "Abonnement introuvable.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("annuler_abonnement", { p_id: id });
  if (error) retour(VENDEUR, messagePourErreur(error, "abonnement"));
  rafraichir();
  retour(VENDEUR, undefined, "Demande annulée.");
}

function lireMotif(formData: FormData, obligatoire: boolean): string | null {
  const motif = texteNettoye(formData.get("motif"));
  if (!motif && !obligatoire) return null;
  if (longueur(motif) < 3) retour(ADMIN, "Écrivez le motif, il sera montré au commerçant.");
  if (longueur(motif) > 500) retour(ADMIN, "Motif : 500 caractères au plus.");
  return motif;
}

export async function deciderAbonnementAction(formData: FormData): Promise<void> {
  const id = formData.get("abonnement");
  if (!estUuid(id)) retour(ADMIN, "Abonnement introuvable.");
  const accepter = formData.get("decision") === "accepter";
  const motif = lireMotif(formData, !accepter);

  const { supabase, userId } = await membre();
  const { error } = await supabase.rpc("decider_abonnement", { p_id: id, p_accepter: accepter, p_motif: motif ?? undefined });
  if (error) retour(ADMIN, messagePourErreur(error, "abonnement"));
  after(() =>
    informerDeLAbonnement(supabase, userId, id, (a) =>
      accepter
        ? `Votre abonnement ${a.formule} est actif jusqu'au ${dateLongue(a.finAt)}.` +
          (a.prixGnf ? ` Paiement de ${formatGnf(a.prixGnf)} bien reçu, merci.` : "")
        : `Votre demande d'abonnement ${a.formule} est refusée. Motif : ${motif}` +
          (a.prixGnf ? ` Si vous l'avez déjà payée, l'équipe vous rembourse ${formatGnf(a.prixGnf)}.` : ""),
    ),
  );
  rafraichir();
  retour(ADMIN, undefined, accepter ? "Abonnement activé." : "Demande refusée.");
}

export async function interrompreAbonnementAction(formData: FormData): Promise<void> {
  const id = formData.get("abonnement");
  if (!estUuid(id)) retour(ADMIN, "Abonnement introuvable.");
  const motif = lireMotif(formData, true);
  const { supabase, userId } = await membre();
  const { error } = await supabase.rpc("interrompre_abonnement", { p_id: id, p_motif: motif! });
  if (error) retour(ADMIN, messagePourErreur(error, "abonnement"));
  after(() => informerDeLAbonnement(supabase, userId, id, (a) => `Votre abonnement ${a.formule} a été interrompu. Motif : ${motif}`));
  rafraichir();
  retour(ADMIN, undefined, "Abonnement interrompu.");
}

export async function marquerAbonnementRembourseAction(formData: FormData): Promise<void> {
  const id = formData.get("abonnement");
  if (!estUuid(id)) retour(ADMIN, "Abonnement introuvable.");
  const { supabase, userId } = await membre();
  const { error } = await supabase.rpc("marquer_abonnement_rembourse", { p_id: id });
  if (error) retour(ADMIN, messagePourErreur(error, "abonnement"));
  after(() =>
    informerDeLAbonnement(
      supabase,
      userId,
      id,
      (a) => `L'équipe Filloo vous a remboursé ${a.prixGnf ? formatGnf(a.prixGnf) : "votre paiement"} pour l'abonnement ${a.formule}.`,
    ),
  );
  rafraichir();
  retour(ADMIN, undefined, "Remboursement noté.");
}

/** L'équipe active elle-même un abonnement : payé en main propre, par mobile, ou offert. */
export async function creerAbonnementEquipeAction(formData: FormData): Promise<void> {
  const boutique = formData.get("boutique");
  if (!estUuid(boutique)) retour(ADMIN, "Choisissez une boutique.");
  const formule = lireFormulePayante(formData.get("formule"));
  if (!formule) retour(ADMIN, "Choisissez Pro ou Business.");
  const moyen = lireMoyen(formData.get("moyen"));
  if (!moyen) retour(ADMIN, "Indiquez comment il a été payé, ou « Offert ».");
  const reference = texteNettoye(formData.get("reference"));
  if (reference && (longueur(reference) < 3 || longueur(reference) > 60)) retour(ADMIN, "Référence : de 3 à 60 caractères.");

  const { supabase, userId } = await membre();
  const { data: id, error } = await supabase.rpc("creer_abonnement_equipe", {
    p_merchant: boutique,
    p_formule: formule,
    p_moyen: moyen,
    p_reference: reference || undefined,
  });
  if (error || !id) retour(ADMIN, error ? messagePourErreur(error, "abonnement") : "Abonnement non créé.");
  after(() =>
    informerDeLAbonnement(supabase, userId, id, (a) =>
      moyen === "offert"
        ? `L'équipe Filloo vous offre l'abonnement ${a.formule} jusqu'au ${dateLongue(a.finAt)}.`
        : `Votre abonnement ${a.formule} est actif jusqu'au ${dateLongue(a.finAt)}.`,
    ),
  );
  rafraichir();
  retour(ADMIN, undefined, "Abonnement activé.");
}

/** Le prix mensuel d'une formule. Il vaut pour les prochaines demandes. */
export async function fixerTarifsAbonnementAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  let changes = 0;
  for (const f of ["pro", "business"] as FormulePayante[]) {
    const brut = String(formData.get(`prix:${f}`) ?? "").replace(/\D/g, "");
    const ancien = String(formData.get(`ancien:${f}`) ?? "").replace(/\D/g, "");
    if (brut === "" || brut === ancien) continue;
    const prix = Number(brut);
    if (!Number.isSafeInteger(prix) || prix > 100_000_000) retour(ADMIN_TARIFS, "Un prix va de 0 à 100 000 000 GNF.");
    const { error } = await supabase.rpc("fixer_tarif_abonnement", { p_formule: f, p_prix: prix });
    if (error) retour(ADMIN_TARIFS, messagePourErreur(error, "tarif"));
    changes++;
  }
  revalidatePath(ADMIN_TARIFS);
  revalidatePath(VENDEUR);
  retour(ADMIN_TARIFS, undefined, changes ? "Prix des abonnements enregistrés." : "Aucun prix changé.");
}
