"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOGUE } from "@/lib/data/catalogue-public";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lireComptesSuspendus, lireDecision, lireSignalement } from "@/lib/data/moderation";
import { messagePourErreur } from "@/lib/erreurs";
import { estUuid, longueur, texteNettoye } from "@/lib/saisie";

/**
 * Les gestes de modération de l'équipe (0046). Écrits AVEC la session : ce
 * sont les fonctions de la base qui exigent d'être de l'équipe, signent du
 * nom de l'auteur et écrivent l'historique. Le site ne fait que choisir
 * l'ordre des appels et dire le résultat.
 */

const MODERATION = "/admin/moderation";
/** Les bornes de 0046 pour un motif. */
const MOTIF_MIN = 3;
const MOTIF_MAX = 500;

function retour(chemin: string, erreur?: string, info?: string): never {
  const params = new URLSearchParams();
  if (erreur) params.set("erreur", erreur);
  if (info) params.set("info", info);
  const q = params.toString();
  redirect(`${chemin}${q ? `?${q}` : ""}`);
}

function lireMotif(formData: FormData, chemin: string, quoi: string): string {
  const motif = texteNettoye(formData.get("motif"));
  if (longueur(motif) < MOTIF_MIN) retour(chemin, `Écrivez le motif ${quoi}.`);
  if (longueur(motif) > MOTIF_MAX) retour(chemin, `Motif : ${MOTIF_MAX} caractères au plus.`);
  return motif;
}

function rafraichir(): void {
  // Le catalogue public aussi : une décision se voit aussitôt, pas une minute après.
  revalidateTag(CATALOGUE, { expire: 0 });
  revalidatePath(MODERATION);
  revalidatePath(`${MODERATION}/historique`);
}

/**
 * Traiter un signalement : classer sans suite, masquer le produit, ou
 * suspendre l'un des comptes en cause. Le geste d'abord, la clôture
 * ensuite : un signalement fermé sans que la sanction soit passée serait
 * pire qu'un signalement resté ouvert, qu'on peut toujours reprendre.
 */
export async function traiterSignalementAction(formData: FormData): Promise<void> {
  const id = formData.get("signalement");
  if (!estUuid(id)) retour(MODERATION, "Signalement introuvable.");
  const chemin = `/admin/signalement/${id}`;
  // « suite:profil » : un seul groupe de boutons, car il y a deux comptes à suspendre dans un fil.
  const [brut, profil] = String(formData.get("choix") ?? "").split(":");
  const decision = lireDecision(brut);
  if (!decision) retour(chemin, "Choisissez une suite.");

  const supabase = await createClient();
  // Relu côté serveur : le formulaire ne dit pas quel compte est en cause, il choisit parmi ceux du signalement.
  const s = await lireSignalement(supabase, id);
  if (!s) retour(MODERATION, undefined, "Ce signalement a déjà été traité.");

  if (decision === "produit_masque") {
    if (s.target_type !== "product") retour(chemin, "Ce signalement ne vise pas un produit.");
    const motif = lireMotif(formData, chemin, "du masquage");
    /* Toujours appelé, même si le produit est déjà `hidden` : le commerçant
       a pu le masquer lui-même et le republierait. Seul le masquage de
       l'équipe (`masque_par_equipe`) l'en empêche ; un second appel ne fait rien. */
    const { error } = await supabase.rpc("masquer_produit", { p_product: s.target_id, p_motif: motif });
    if (error) retour(chemin, messagePourErreur(error, "modération"));
  }

  if (decision === "compte_suspendu") {
    const candidats = [s.merchant_profile_id, s.conv_client_profile_id, s.conv_merchant_profile_id].filter(Boolean);
    if (!estUuid(profil) || !candidats.includes(profil)) retour(chemin, "Choisissez le compte à suspendre.");
    const motif = lireMotif(formData, chemin, "de la suspension, il sera montré à la personne");
    /* Une suspension passée lors d'un essai précédent, dont la clôture a
       échoué : on ne la refait pas (la base refuserait), on clôt. */
    const dejaSuspendu = (await lireComptesSuspendus(supabase)).some((c) => c.profile_id === profil);
    if (!dejaSuspendu) {
      const { error } = await supabase.rpc("suspendre_profil", { p_profile: profil, p_motif: motif });
      if (error) retour(chemin, messagePourErreur(error, "modération"));
    }
  }

  const { error } = await supabase.rpc("traiter_signalement", { p_report: id, p_decision: decision });
  if (error) retour(chemin, messagePourErreur(error, "modération"));

  rafraichir();
  retour(MODERATION, undefined, "Signalement traité.");
}

/** Lever une suspension. Le motif reste interne : la personne le constate en se reconnectant (0021). */
export async function reactiverCompteAction(formData: FormData): Promise<void> {
  const profil = formData.get("profil");
  if (!estUuid(profil)) retour(MODERATION, "Compte introuvable.");
  const motif = lireMotif(formData, MODERATION, "de la réactivation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("reactiver_profil", { p_profile: profil, p_motif: motif });
  if (error) retour(MODERATION, messagePourErreur(error, "modération"));

  rafraichir();
  retour(MODERATION, undefined, "Compte réactivé.");
}
