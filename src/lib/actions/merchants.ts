"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { passwordIsValid } from "@/lib/supabase/verify";
import { erreurTelephone, nettoyerTelephone } from "@/lib/telephone";
import { getMyProfile, getSessionUser } from "@/lib/data/session";
import type { ActionState } from "@/lib/actions/auth";
import { compter } from "@/lib/analytics";

/** Écran 13 — création de la boutique, étape 2 de l'inscription commerçant.
 * La policy "merchants: je cree ma boutique" (0002) vérifie déjà que
 * `profile_id` appartient au commerçant connecté ; inutile de le
 * revérifier ici, mais on a besoin de l'id pour l'insertion. */
export async function createMerchantAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const shopName = String(formData.get("shopName") ?? "").trim();
  const cityId = Number(formData.get("cityId") ?? 0);
  const addressHint = String(formData.get("addressHint") ?? "").trim();
  const whatsappPhone = String(formData.get("whatsappPhone") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!shopName || !cityId) {
    return { error: "Le nom de la boutique et la ville sont obligatoires." };
  }
  // Facultatif, mais joignable s'il est renseigné : un numéro faux sous
  // une boutique est pire qu'aucun numéro, le client croyant avoir un
  // recours.
  const erreurWhatsapp = erreurTelephone(whatsappPhone, false, "WhatsApp");
  if (erreurWhatsapp) return { error: erreurWhatsapp };

  const supabase = await createClient();
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchantProfile) return { error: "Vous devez d'abord créer un compte commerçant." };

  /* LAISSÉ VIDE = LE NUMÉRO DU COMPTE. Le commerçant a déjà donné un
     numéro à l'inscription ; le redemander est une friction qui se paie
     cher, parce que le champ sauté fait DISPARAÎTRE le bouton WhatsApp de
     ses fiches produit — sans que rien ne le lui dise. En Guinée, c'est la
     sortie de secours quand la messagerie interne reste sans réponse :
     l'oublier coûte des ventes au commerçant, pas à nous.

     Il reste libre d'en mettre un AUTRE : beaucoup séparent le numéro
     personnel du numéro de commerce, et ce choix-là doit rester possible.
     Ce n'est donc pas un lien automatique entre les deux champs, c'est
     une valeur par défaut au moment de la création. */
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
    return { error: error.message };
  }

  /* La boutique existe en `pending` : c'est bien une création, même si la
     validation viendra plus tard. Compter à l'approbation mesurerait le
     rythme de l'administrateur, pas celui des commerçants. */
  compter("boutique_creee", { role: "merchant", cityId: cityId });

  redirect("/vendeur/attente");
}

/**
 * Renvoyer ma boutique à la vérification — écran 21, après correction.
 *
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
  // Messages déjà en français, lus tels quels comme ceux des triggers.
  if (error) redirect(`/vendeur/refusee?erreur=${encodeURIComponent(error.message)}`);
  redirect("/vendeur/attente");
}

/**
 * Modifier ma boutique — écran 26. Ne touche jamais `status` : changer le
 * nom ou la ville ne déclenche PAS de nouvelle vérification, et en ajouter
 * une ferait disparaître du catalogue les produits en ligne (la policy
 * "products: catalogue public" exige `approved`). Contradiction avec la
 * maquette encore ouverte — voir docs/MEMOIRE.md, « Dettes techniques ».
 */
export async function updateMerchantAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const shopName = String(formData.get("shopName") ?? "").trim();
  const cityId = Number(formData.get("cityId") ?? 0);
  const addressHint = String(formData.get("addressHint") ?? "").trim();
  const whatsappPhone = String(formData.get("whatsappPhone") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const currentPassword = String(formData.get("currentPassword") ?? "");

  if (!shopName || !cityId) {
    return { error: "Le nom de la boutique et la ville sont obligatoires." };
  }
  const erreurWhatsapp = erreurTelephone(whatsappPhone, false, "WhatsApp");
  if (erreurWhatsapp) return { error: erreurWhatsapp };

  // Ce qui peut être refusé l'est avant la première écriture.
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
    // Sec, et il dit ce qui compte : que rien n'a bougé.
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
    })
    .eq("profile_id", merchantProfile.id)
    .select("id");
  if (error) return { error: error.message };
  // Comme pour le profil client : un `update` écarté par le RLS répond un
  // succès à zéro ligne, qu'on ne laisse pas passer pour un enregistrement.
  if (!data || data.length === 0) {
    return { error: "Enregistrement impossible. Reconnectez-vous, puis réessayez." };
  }

  // Retour sur la consultation, pas l'accueil : les deux sorties de
  // l'écran d'édition mènent là d'où l'on vient.
  redirect("/vendeur/boutique");
}
