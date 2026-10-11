"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { passwordIsValid } from "@/lib/supabase/verify";
import { nettoyerTelephone } from "@/lib/telephone";
import { CHEMIN_PHOTO, ecrireMaBoutique, lireBoutique } from "@/lib/ecritures-protegees";
import { getMyProfile, getSessionUser } from "@/lib/data/session";
import type { ActionState } from "@/lib/actions/auth";
import { compter } from "@/lib/analytics";
import { messagePourErreur } from "@/lib/erreurs";
import { SHOP_PHOTOS_BUCKET } from "@/lib/storage";

/** La policy "merchants: je cree ma boutique" (0002) vérifie déjà que
 * `profile_id` appartient au commerçant connecté ; inutile de le
 * revérifier ici, mais on a besoin de l'id pour l'insertion. */
export async function createMerchantAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const lu = lireBoutique((champ) => formData.get(champ));
  if ("error" in lu) return lu;
  const { shopName, cityId, addressHint, whatsappPhone, description } = lu;


  const supabase = await createClient();
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchantProfile) return { error: "Vous devez d'abord créer un compte commerçant." };

  const numeroWhatsapp = nettoyerTelephone(whatsappPhone) || merchantProfile.phone || null;

  const { error } = await supabase.from("merchants").insert({
    profile_id: merchantProfile.id,
    shop_name: shopName,
    city_id: cityId,
    address_hint: addressHint || null,
    whatsapp_phone: numeroWhatsapp,
    description: description || null,
  });
  if (error) {
    if (error.code === "23505") return { error: "Vous avez déjà une boutique." };
    return { error: messagePourErreur(error, "boutique") };
  }

  compter("boutique_creee", { role: "merchant", cityId: cityId });

  redirect("/vendeur");
}

export async function updateMerchantAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const lu = lireBoutique((champ) => formData.get(champ));
  if ("error" in lu) return lu;
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const photoPath = String(formData.get("photoPath") ?? "");

  if (formData.get("photoEnCours")) {
    return { error: "La photo est encore en cours d'envoi. Attendez qu'elle s'affiche, puis réessayez." };
  }
  if (photoPath && !CHEMIN_PHOTO.test(photoPath)) {
    return { error: "Photo invalide. Choisissez-la de nouveau." };
  }

  if (!currentPassword) {
    return { error: "Confirmez avec votre mot de passe actuel pour enregistrer." };
  }

  const supabase = await createClient();
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchantProfile) return { error: "Vous devez être connecté en tant que commerçant." };

  /* Adresse et WhatsApp sont ce qu'un client lit avant de se déplacer :
     les réécrire détourne les acheteurs d'une boutique. Le mot de passe
     redemandé distingue « cette session est ouverte » de « c'est bien la
     bonne personne ».

     Supabase n'ayant pas d'appel « vérifie ce mot de passe »,
     `passwordIsValid` se connecte avec un client JETABLE, sans cookie
     (`src/lib/supabase/verify.ts`) : une faute de frappe ne déconnecte
     donc pas au milieu du formulaire. */
  const user = await getSessionUser(supabase);
  if (!user?.email) {
    // Cas théorique (l'inscription passe toujours par un email) : on
    // refuse plutôt que d'écrire sans avoir rien pu vérifier.
    return { error: "Impossible de vérifier votre mot de passe. Reconnectez-vous, puis réessayez." };
  }

  if (!(await passwordIsValid(user.email, currentPassword))) {
    return { error: "Mot de passe actuel incorrect. Aucune modification n'a été enregistrée." };
  }

  /* Écrite par le serveur (0036, 0037) : la session seule ne peut plus
     toucher à ces colonnes, sans quoi le mot de passe ne protégerait que
     ce formulaire. */
  const { data: boutiqueId, error } = await ecrireMaBoutique(user.id, lu, photoPath);
  if (error) return { error: messagePourErreur(error, "boutique") };
  // Profil suspendu, supprimé, ou pas de boutique : rien n'a été écrit, et
  // on ne le laisse pas passer pour un enregistrement.
  if (!boutiqueId) {
    return { error: "Enregistrement impossible. Reconnectez-vous, puis réessayez." };
  }

  await effacerAnciennesPhotos(boutiqueId, photoPath || null);

  redirect("/vendeur/boutique");
}

/**
 * Tout ce que le dossier de la boutique porte en plus de la photo
 * retenue : la photo remplacée ou retirée, et celles envoyées puis
 * abandonnées (formulaire quitté sans enregistrer). Le dossier ne garde
 * ainsi jamais qu'un fichier au plus, sans passer par le ménage du matin.
 *
 * Un échec ici ne défait pas l'enregistrement : la boutique affiche déjà
 * la bonne photo, il ne reste qu'un fichier de trop.
 */
async function effacerAnciennesPhotos(merchantId: string, garder: string | null) {
  const supabase = await createClient();
  const { data: fichiers, error } = await supabase.storage.from(SHOP_PHOTOS_BUCKET).list(merchantId);
  if (error) {
    console.error("[photo boutique] dossier non lu :", error.message);
    return;
  }
  const aEffacer = (fichiers ?? [])
    .map((fichier) => `${merchantId}/${fichier.name}`)
    .filter((chemin) => chemin !== garder);
  if (aEffacer.length === 0) return;
  const { error: erreurEffacement } = await supabase.storage.from(SHOP_PHOTOS_BUCKET).remove(aEffacer);
  if (erreurEffacement) console.error("[photo boutique] anciennes photos non effacées :", erreurEffacement.message);
}
