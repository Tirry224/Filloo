"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { passwordIsValid } from "@/lib/supabase/verify";
import { erreurTelephone, nettoyerTelephone } from "@/lib/telephone";
import { getMyProfile, getSessionUser } from "@/lib/data/session";
import type { ActionState } from "@/lib/actions/auth";
import { compter } from "@/lib/analytics";
import { messagePourErreur } from "@/lib/erreurs";
import { erreurNom, lireIdEntier, longueur, texteNettoye } from "@/lib/saisie";
import { SHOP_PHOTOS_BUCKET } from "@/lib/storage";

/** `{merchant_id}/{uuid}.webp` — ou `.jpg` là où le navigateur n'encode
 * pas le WebP (Safari, 0031) : les seuls chemins que `ShopPhotoPicker`
 * produit. Que le dossier soit bien CELUI de la boutique, c'est la base
 * qui le garantit (`merchants_photo_path_dans_son_dossier`, 0029). */
const CHEMIN_PHOTO = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg)$/;

/** Les champs d'une boutique, lus ET validés en un geste, pour la
 * création comme pour la modification. Le nom est ce qu'un client lit en
 * premier : trois caractères invisibles ou 5 000 lettres passaient, et
 * une ville forgée (`1.5`, `999`) faisait répondre la base en anglais
 * (2026-09-25). */
function lireBoutique(formData: FormData):
  | { shopName: string; cityId: number; addressHint: string; whatsappPhone: string; description: string }
  | { error: string } {
  const shopName = texteNettoye(formData.get("shopName"));
  const cityId = lireIdEntier(formData.get("cityId"));
  const addressHint = texteNettoye(formData.get("addressHint"));
  const whatsappPhone = String(formData.get("whatsappPhone") ?? "").trim();
  const description = texteNettoye(formData.get("description"));

  if (!shopName || !cityId) {
    return { error: "Le nom de la boutique et la ville sont obligatoires." };
  }
  const erreurNomBoutique = erreurNom(shopName, "Nom de la boutique");
  if (erreurNomBoutique) return { error: erreurNomBoutique };
  if (longueur(addressHint) > ADRESSE_MAX) return { error: `« Où vous trouver » : ${ADRESSE_MAX} caractères maximum.` };
  if (longueur(description) > DESCRIPTION_BOUTIQUE_MAX) {
    return { error: `La description : ${DESCRIPTION_BOUTIQUE_MAX} caractères maximum.` };
  }
  const erreurWhatsapp = erreurTelephone(whatsappPhone, false, "WhatsApp");
  if (erreurWhatsapp) return { error: erreurWhatsapp };

  return { shopName, cityId, addressHint, whatsappPhone, description };
}

const ADRESSE_MAX = 200;
const DESCRIPTION_BOUTIQUE_MAX = 1000;

/** La policy "merchants: je cree ma boutique" (0002) vérifie déjà que
 * `profile_id` appartient au commerçant connecté ; inutile de le
 * revérifier ici, mais on a besoin de l'id pour l'insertion. */
export async function createMerchantAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const lu = lireBoutique(formData);
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

  redirect("/vendeur/attente");
}

/**
 * Le statut est écrit par `resubmit_my_merchant()` (0015), qui n'autorise
 * que 'rejected' → 'pending' sur la boutique de l'appelant : le commerçant
 * n'a aucun droit d'écriture sur `merchants.status`, et c'est la base qui
 * le garantit, pas cet écran.
 *
 * `<form>` serveur sans `useActionState` : son erreur voyage dans l'URL,
 * lue par `Notice` sur `/vendeur/refusee`.
 */
export async function resubmitMerchantAction() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resubmit_my_merchant");
  if (error) redirect(`/vendeur/refusee?erreur=${encodeURIComponent(messagePourErreur(error, "boutique"))}`);
  redirect("/vendeur/attente");
}

/**
 * Ne touche jamais `status` : changer le
 * nom ou la ville ne déclenche PAS de nouvelle vérification, et en ajouter
 * une ferait disparaître du catalogue les produits en ligne (la policy
 * "products: catalogue public" exige `approved`). Contradiction avec la
 * maquette encore ouverte — voir docs/MEMOIRE.md, « Dettes techniques ».
 */
export async function updateMerchantAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const lu = lireBoutique(formData);
  if ("error" in lu) return lu;
  const { shopName, cityId, addressHint, whatsappPhone, description } = lu;
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

  const { data, error } = await supabase
    .from("merchants")
    .update({
      shop_name: shopName,
      city_id: cityId,
      address_hint: addressHint || null,
      whatsapp_phone: nettoyerTelephone(whatsappPhone) || null,
      description: description || null,
      photo_path: photoPath || null,
    })
    .eq("profile_id", merchantProfile.id)
    .select("id");
  if (error) return { error: messagePourErreur(error, "boutique") };
  // Comme pour le profil client : un `update` écarté par le RLS répond un
  // succès à zéro ligne, qu'on ne laisse pas passer pour un enregistrement.
  if (!data || data.length === 0) {
    return { error: "Enregistrement impossible. Reconnectez-vous, puis réessayez." };
  }

  await effacerAnciennesPhotos(data[0].id, photoPath || null);

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
