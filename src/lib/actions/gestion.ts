"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { messagePourErreur } from "@/lib/erreurs";
import { estUuid, lireIdEntier, longueur, texteNettoye } from "@/lib/saisie";
import { espaceDuRole } from "@/lib/data/gestion";
import { effacerPhotosDuProduit, supprimerProfil } from "@/lib/suppression-compte";

/**
 * Les gestes de `/admin/gestion` (2026-11-07). Écrits AVEC la session du
 * membre : la base vérifie qu'il est de l'équipe, signe le journal et
 * refuse ce qui casserait le site (dernier membre, catégorie utilisée…).
 * Le site ne fait que lire le formulaire et dire le résultat.
 */

const GESTION = "/admin/gestion";
const MOTIF_MIN = 3;
const MOTIF_MAX = 500;

/** La page où revenir : seulement une page de `/admin/gestion` (une fiche
 *  `/vendeurs/<uuid>` comprise), jamais une adresse fournie de l'extérieur. */
function cheminRetour(formData: FormData): string {
  const brut = String(formData.get("retour") ?? "");
  return /^\/admin\/gestion(\/[a-z-]+(\/[0-9a-f-]{36})?)?(\?[\w=&%+.-]*)?$/.test(brut) ? brut : GESTION;
}

function retour(chemin: string, erreur?: string, info?: string): never {
  const [base, requete] = chemin.split("?");
  const params = new URLSearchParams(requete);
  params.delete("erreur");
  params.delete("info");
  if (erreur) params.set("erreur", erreur);
  if (info) params.set("info", info);
  const q = params.toString();
  redirect(`${base}${q ? `?${q}` : ""}`);
}

function lireMotif(formData: FormData, chemin: string, quoi: string): string {
  const motif = texteNettoye(formData.get("motif"));
  if (longueur(motif) < MOTIF_MIN) retour(chemin, `Écrivez le motif ${quoi}.`);
  if (longueur(motif) > MOTIF_MAX) retour(chemin, `Motif : ${MOTIF_MAX} caractères au plus.`);
  return motif;
}

function rafraichir(): void {
  revalidatePath(GESTION, "layout");
  revalidatePath("/admin/moderation");
}

/* ---------- Comptes ---------- */

export async function suspendreCompteAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const profil = formData.get("profil");
  if (!estUuid(profil)) retour(chemin, "Compte introuvable.");
  const motif = lireMotif(formData, chemin, "de la suspension, il sera montré à la personne");
  const supabase = await createClient();
  const { error } = await supabase.rpc("suspendre_profil", { p_profile: profil, p_motif: motif });
  if (error) retour(chemin, messagePourErreur(error, "modération"));
  rafraichir();
  retour(chemin, undefined, "Compte suspendu.");
}

export async function reactiverCompteGestionAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const profil = formData.get("profil");
  if (!estUuid(profil)) retour(chemin, "Compte introuvable.");
  const motif = lireMotif(formData, chemin, "de la réactivation");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reactiver_profil", { p_profile: profil, p_motif: motif });
  if (error) retour(chemin, messagePourErreur(error, "modération"));
  rafraichir();
  retour(chemin, undefined, "Compte réactivé.");
}

/**
 * Supprimer un compte (2026-11-07) : la même anonymisation que « supprimer
 * mon compte » (`supprimerProfil`), jamais un vrai `delete` — les fils des
 * autres personnes gardent leurs messages. Irréversible : case à cocher et
 * motif obligatoires.
 *
 * Ordre voulu : `equipe_compte` d'abord (la base refuse un non-membre, et
 * dit si la cible est de l'équipe), puis l'effacement en `service_role`,
 * puis le journal — qui refuse un profil non supprimé : il ne dit jamais
 * qu'une suppression a eu lieu si elle a échoué.
 */
export async function supprimerCompteAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const profil = formData.get("profil");
  if (!estUuid(profil)) retour(chemin, "Compte introuvable.");
  if (formData.get("confirmer") !== "oui") retour(chemin, "Cochez la case pour confirmer la suppression.");
  const motif = lireMotif(formData, chemin, "de la suppression (interne à l'équipe)");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("equipe_compte", { p_profile: profil });
  if (error) retour(chemin, messagePourErreur(error, "modération"));
  const fiche = data?.[0];
  if (!fiche) retour(chemin, "Compte introuvable.");
  const liste = `${GESTION}/${espaceDuRole(fiche.role)}`;
  if (fiche.est_de_l_equipe) retour(chemin, "Ce compte appartient à un membre de l'équipe : retirez-le d'abord de l'équipe.");

  const nom = fiche.shop_name ?? fiche.nom ?? "Sans nom";
  const motifJournal = `${nom}${fiche.email ? ` <${fiche.email}>` : ""} — ${motif}`.slice(0, MOTIF_MAX);
  /* Déjà supprimé : on n'efface rien de plus, mais on rejoue le journal
     (sans effet s'il est déjà écrit) — une suppression dont le journal
     avait échoué retrouve ainsi sa trace. */
  if (fiche.is_deleted) {
    await supabase.rpc("journaliser_suppression_compte", { p_profile: profil, p_motif: motifJournal });
    retour(liste, undefined, "Ce compte était déjà supprimé.");
  }
  try {
    await supprimerProfil(fiche.auth_user_id, fiche.role === "merchant" ? "merchant" : "client");
  } catch (e) {
    console.error("[gestion] suppression de compte interrompue :", e);
    retour(chemin, "La suppression a été interrompue. Relancez-la : elle reprend là où elle s'est arrêtée.");
  }

  const { error: journalError } = await supabase.rpc("journaliser_suppression_compte", {
    p_profile: profil,
    p_motif: motifJournal,
  });
  if (journalError) console.error("[gestion] suppression faite, journal non écrit :", journalError.message);
  rafraichir();
  retour(liste, undefined, `${nom} : compte supprimé.`);
}

/* ---------- Produits ---------- */

export async function masquerProduitGestionAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const produit = formData.get("produit");
  if (!estUuid(produit)) retour(chemin, "Produit introuvable.");
  const motif = lireMotif(formData, chemin, "du masquage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("masquer_produit", { p_product: produit, p_motif: motif });
  if (error) retour(chemin, messagePourErreur(error, "modération"));
  rafraichir();
  retour(chemin, undefined, "Produit masqué.");
}

export async function demasquerProduitAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const produit = formData.get("produit");
  if (!estUuid(produit)) retour(chemin, "Produit introuvable.");
  const motif = lireMotif(formData, chemin, "du démasquage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("demasquer_produit", { p_produit: produit, p_motif: motif });
  if (error) retour(chemin, messagePourErreur(error, "modération"));
  rafraichir();
  retour(chemin, undefined, "Produit démasqué : le commerçant peut le republier.");
}

/** Suppression définitive d'un produit par l'équipe (2026-11-07). La base
 *  vérifie, journalise et supprime ; les photos partent ensuite du stockage
 *  (son dossier `{merchant_id}/{product_id}`, 0004), au mieux. */
export async function supprimerProduitEquipeAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const produit = formData.get("produit");
  if (!estUuid(produit)) retour(chemin, "Produit introuvable.");
  if (formData.get("confirmer") !== "oui") retour(chemin, "Cochez la case pour confirmer la suppression.");
  const motif = lireMotif(formData, chemin, "de la suppression");
  const supabase = await createClient();
  const { data: merchantId, error } = await supabase.rpc("supprimer_produit_equipe", { p_produit: produit, p_motif: motif });
  if (error) retour(chemin, messagePourErreur(error, "modération"));
  if (merchantId) await effacerPhotosDuProduit(merchantId, produit);
  rafraichir();
  retour(chemin, undefined, "Produit supprimé.");
}

/* ---------- Équipe ---------- */

export async function ajouterMembreAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const email = texteNettoye(formData.get("email")).toLowerCase();
  const nom = texteNettoye(formData.get("nom"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) retour(chemin, "Adresse email invalide.");
  if (longueur(nom) < 1 || longueur(nom) > 60) retour(chemin, "Écrivez le prénom affiché aux collègues (60 caractères au plus).");
  const supabase = await createClient();
  const { error } = await supabase.rpc("ajouter_membre", { p_email: email, p_nom: nom });
  if (error) retour(chemin, messagePourErreur(error, "équipe"));
  rafraichir();
  retour(chemin, undefined, `${nom} fait maintenant partie de l'équipe.`);
}

export async function retirerMembreAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const membre = formData.get("membre");
  if (!estUuid(membre)) retour(chemin, "Membre introuvable.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("retirer_membre", { p_auth: membre });
  if (error) retour(chemin, messagePourErreur(error, "équipe"));
  rafraichir();
  retour(chemin, undefined, "Membre retiré de l'équipe.");
}

/* ---------- Catégories et villes ---------- */

function lireEntree(formData: FormData, chemin: string): { id: number | null; nom: string; position: number | undefined } {
  const brutId = formData.get("id");
  const id = brutId ? lireIdEntier(brutId) : null;
  if (brutId && id === null) retour(chemin, "Élément introuvable.");
  const nom = texteNettoye(formData.get("nom"));
  if (longueur(nom) < 2 || longueur(nom) > 40) retour(chemin, "Le nom doit faire de 2 à 40 caractères.");
  /* Vide = la base place l'élément en fin de liste (0066). */
  const position = Number.parseInt(String(formData.get("position") ?? ""), 10);
  return { id, nom, position: Number.isFinite(position) ? Math.max(0, Math.min(position, 9999)) : undefined };
}

export async function fixerCategorieAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const { id, nom, position } = lireEntree(formData, chemin);
  const supabase = await createClient();
  const { error } = await supabase.rpc("fixer_categorie", { p_id: id ?? undefined, p_nom: nom, p_position: position });
  if (error) retour(chemin, messagePourErreur(error, "catalogue"));
  rafraichir();
  retour(chemin, undefined, id ? "Catégorie modifiée." : "Catégorie ajoutée.");
}

export async function retirerCategorieAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const id = lireIdEntier(formData.get("id"));
  if (id === null) retour(chemin, "Catégorie introuvable.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("retirer_categorie", { p_id: id });
  if (error) retour(chemin, messagePourErreur(error, "catalogue"));
  rafraichir();
  retour(chemin, undefined, "Catégorie retirée.");
}

export async function fixerVilleAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const { id, nom, position } = lireEntree(formData, chemin);
  const supabase = await createClient();
  const { error } = await supabase.rpc("fixer_ville", { p_id: id ?? undefined, p_nom: nom, p_position: position });
  if (error) retour(chemin, messagePourErreur(error, "catalogue"));
  rafraichir();
  retour(chemin, undefined, id ? "Ville modifiée." : "Ville ajoutée.");
}

export async function retirerVilleAction(formData: FormData): Promise<void> {
  const chemin = cheminRetour(formData);
  const id = lireIdEntier(formData.get("id"));
  if (id === null) retour(chemin, "Ville introuvable.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("retirer_ville", { p_id: id });
  if (error) retour(chemin, messagePourErreur(error, "catalogue"));
  rafraichir();
  retour(chemin, undefined, "Ville retirée.");
}
