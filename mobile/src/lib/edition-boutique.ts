import { randomUUID } from "expo-crypto";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { motDePasseValide } from "./compte";
import { supabase } from "./supabase";

/**
 * Créer et modifier une boutique : mêmes règles que `src/lib/actions/merchants.ts`
 * du site. La base a le dernier mot (`merchants_photo_path_dans_son_dossier`,
 * une seule boutique par compte).
 */

export const NOM_MIN = 2;
export const NOM_MAX = 80;
export const ADRESSE_MAX = 200;
export const DESCRIPTION_MAX = 1000;
const BUCKET = "shop-photos";

const INVISIBLES = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const nettoyer = (t: string) => t.replace(INVISIBLES, "").trim();
const longueur = (t: string) => [...t].length;
export const nettoyerTelephone = (v: string) => v.replace(/[\s.\-()]/g, "").replace(/^\+224/, "").replace(/^00224/, "");

export type SaisieBoutique = { nom: string; villeId: number | null; adresse: string; whatsapp: string; description: string };
type Champs = { nom: string; villeId: number; adresse: string; whatsapp: string; description: string };

function controler(s: SaisieBoutique): { champs: Champs } | { erreur: string } {
  const nom = nettoyer(s.nom);
  const adresse = nettoyer(s.adresse);
  const description = nettoyer(s.description);
  const whatsapp = nettoyerTelephone(s.whatsapp.trim());
  if (!nom || !s.villeId) return { erreur: "Le nom de la boutique et la ville sont obligatoires." };
  if (longueur(nom) < NOM_MIN) return { erreur: `Nom de la boutique : ${NOM_MIN} caractères visibles minimum.` };
  if (longueur(nom) > NOM_MAX) return { erreur: `Nom de la boutique : ${NOM_MAX} caractères maximum.` };
  if (longueur(adresse) > ADRESSE_MAX) return { erreur: `« Où vous trouver » : ${ADRESSE_MAX} caractères maximum.` };
  if (longueur(description) > DESCRIPTION_MAX) return { erreur: `La description : ${DESCRIPTION_MAX} caractères maximum.` };
  if (whatsapp && !/^6\d{8}$/.test(whatsapp)) {
    return { erreur: "Entrez un numéro guinéen à 9 chiffres commençant par 6 (exemple : 622 33 44 55)." };
  }
  return { champs: { nom, villeId: s.villeId, adresse, whatsapp, description } };
}

function lisible(erreur: { code?: string; message: string }): string {
  if (erreur.code === "P0001") return erreur.message;
  if (erreur.message.includes("Network request failed")) return "Pas de connexion internet. Rien n'a été enregistré.";
  console.error("[boutique]", erreur.code, erreur.message);
  return "Une erreur est survenue. Réessayez dans un instant.";
}

/**
 * Sans numéro WhatsApp saisi, celui du compte est repris : c'est le numéro
 * sur lequel le commerçant s'est inscrit (comme `createMerchantAction`).
 */
export async function creerBoutique(profilId: string, saisie: SaisieBoutique): Promise<string | null> {
  const lu = controler(saisie);
  if ("erreur" in lu) return lu.erreur;
  const c = lu.champs;
  let numero: string | null = c.whatsapp || null;
  if (!numero) {
    const { data } = await supabase.from("profiles").select("phone").eq("id", profilId).maybeSingle();
    numero = data?.phone ?? null;
  }
  const { error } = await supabase.from("merchants").insert({
    profile_id: profilId,
    shop_name: c.nom,
    city_id: c.villeId,
    address_hint: c.adresse || null,
    whatsapp_phone: numero,
    description: c.description || null,
  });
  if (!error) return null;
  if (error.code === "23505") return "Vous avez déjà une boutique.";
  return lisible(error);
}

/**
 * Adresse et WhatsApp sont ce qu'un client lit avant de se déplacer : les
 * réécrire détournerait les acheteurs. Le mot de passe redemandé distingue
 * « ce téléphone est ouvert » de « c'est bien la bonne personne ».
 */
export async function modifierBoutique(opts: {
  profilId: string;
  boutiqueId: string;
  email: string;
  motDePasse: string;
  saisie: SaisieBoutique;
  photo: string | null;
}): Promise<string | null> {
  const lu = controler(opts.saisie);
  if ("erreur" in lu) return lu.erreur;
  const c = lu.champs;
  if (!opts.motDePasse) return "Confirmez avec votre mot de passe actuel pour enregistrer.";
  if (!(await motDePasseValide(opts.email, opts.motDePasse))) {
    return "Mot de passe actuel incorrect. Aucune modification n'a été enregistrée.";
  }
  const { data, error } = await supabase
    .from("merchants")
    .update({
      shop_name: c.nom,
      city_id: c.villeId,
      address_hint: c.adresse || null,
      whatsapp_phone: c.whatsapp || null,
      description: c.description || null,
      photo_path: opts.photo,
    })
    .eq("profile_id", opts.profilId)
    .select("id");
  if (error) return lisible(error);
  if (!data || data.length === 0) return "Enregistrement impossible. Reconnectez-vous, puis réessayez.";
  await effacerAnciennesPhotos(opts.boutiqueId, opts.photo);
  return null;
}

/** Le dossier de la boutique ne garde que la photo retenue. Un échec ici ne défait rien. */
async function effacerAnciennesPhotos(boutiqueId: string, garder: string | null) {
  const { data: fichiers, error } = await supabase.storage.from(BUCKET).list(boutiqueId);
  if (error) return;
  const aEffacer = (fichiers ?? []).map((f) => `${boutiqueId}/${f.name}`).filter((c) => c !== garder);
  if (aEffacer.length > 0) await supabase.storage.from(BUCKET).remove(aEffacer);
}

/** La photo de boutique : 512 px au plus, rangée sous `{boutique}/{uuid}.jpg` (0029). */
export async function envoyerPhotoBoutique(opts: { uri: string; largeur: number; hauteur: number; boutiqueId: string }) {
  const COTE_MAX = 512;
  let contexte = ImageManipulator.manipulate(opts.uri);
  if (Math.max(opts.largeur, opts.hauteur) > COTE_MAX) {
    contexte = contexte.resize(opts.largeur >= opts.hauteur ? { width: COTE_MAX } : { height: COTE_MAX });
  }
  const image = await (await contexte.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!image.base64) throw new Error("photo illisible");
  const octets = Uint8Array.from(atob(image.base64), (ch) => ch.charCodeAt(0));
  const chemin = `${opts.boutiqueId}/${randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, octets, { contentType: "image/jpeg" });
  if (error) throw error;
  return chemin;
}

/** Les champs bruts de ma boutique, pour pré-remplir la modification. */
export async function lireBoutiqueAEditer(boutiqueId: string) {
  const { data, error } = await supabase
    .from("merchants")
    .select("shop_name, city_id, address_hint, whatsapp_phone, description, photo_path")
    .eq("id", boutiqueId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Ouvrir une boutique depuis un compte client : un SECOND profil lié à la
 * même connexion (`createLinkedProfileAction`). Nom et téléphone se
 * recopient du profil existant : ils appartiennent à la connexion.
 */
export async function creerCompteCommercantLie(authUserId: string): Promise<string | null> {
  const { data: existant } = await supabase
    .from("profiles")
    .select("full_name, phone, is_deleted")
    .eq("auth_user_id", authUserId)
    .eq("role", "client")
    .maybeSingle();
  if (!existant || existant.is_deleted) return "Aucun compte à lier. Reconnectez-vous, puis réessayez.";
  const { error } = await supabase
    .from("profiles")
    .insert({ auth_user_id: authUserId, role: "merchant", full_name: existant.full_name, phone: existant.phone });
  if (!error) return null;
  if (error.code === "23505") return "Vous avez déjà un compte commerçant.";
  return lisible(error);
}
