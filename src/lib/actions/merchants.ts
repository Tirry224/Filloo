"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { passwordIsValid } from "@/lib/supabase/verify";
import { erreurTelephone, nettoyerTelephone } from "@/lib/telephone";
import { getMyProfile, getSessionUser } from "@/lib/data/session";
import type { ActionState } from "@/lib/actions/auth";

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
  /* Le WhatsApp n'est PAS obligatoire — tous les commerçants n'en ont
     pas — mais s'il est renseigné il doit être joignable : un numéro
     à sept chiffres affiché sous une boutique est pire que pas de
     numéro du tout, parce que le client croit avoir un recours. */
  const erreurWhatsapp = erreurTelephone(whatsappPhone, false, "WhatsApp");
  if (erreurWhatsapp) return { error: erreurWhatsapp };

  const supabase = await createClient();
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchantProfile) return { error: "Vous devez d'abord créer un compte commerçant." };

  const { error } = await supabase.from("merchants").insert({
    profile_id: merchantProfile.id,
    shop_name: shopName,
    city_id: cityId,
    address_hint: addressHint || null,
    whatsapp_phone: nettoyerTelephone(whatsappPhone) || null,
    description: description || null,
  });
  if (error) {
    if (error.code === "23505") return { error: "Vous avez déjà une boutique." };
    return { error: error.message };
  }

  redirect("/vendeur/attente");
}

/**
 * Renvoyer ma boutique à la vérification — écran 21, après correction.
 * Sans cette flèche, corriger ses informations ne changeait pas
 * `merchants.status` : une boutique refusée le restait indéfiniment.
 *
 * Le statut est écrit par `resubmit_my_merchant()` (0015), en base, qui
 * n'autorise que 'rejected' → 'pending' et seulement sur la boutique de
 * l'appelant : le commerçant n'a aucun droit d'écriture sur
 * `merchants.status`, et c'est la base qui le garantit, pas cet écran.
 *
 * `<form>` de composant serveur, sans `useActionState` : elle marche
 * sans JavaScript, son erreur voyage donc dans l'URL, lue par `Notice`
 * sur `/vendeur/refusee`.
 */
export async function resubmitMerchantAction() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resubmit_my_merchant");
  // Les messages de la fonction sont déjà écrits en français pour être lus
  // tels quels, comme ceux des triggers de 0002.
  if (error) redirect(`/vendeur/refusee?erreur=${encodeURIComponent(error.message)}`);
  redirect("/vendeur/attente");
}

/**
 * Modifier ma boutique — écran 26. Ne touche jamais `status` : contrairement
 * à ce que la maquette affichait, changer le nom ou la ville ne déclenche
 * PAS de nouvelle vérification — aucune règle de la base ne le fait, et en
 * ajouter une ferait disparaître du catalogue public les produits déjà en
 * ligne (la policy "products: catalogue public" exige une boutique
 * `approved`). Contradiction encore ouverte, à trancher avec le porteur du
 * projet avant de réintroduire ce texte — voir docs/REPRISE.md.
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

  /* CE QUI PEUT ÊTRE REFUSÉ L'EST AVANT LA PREMIÈRE ÉCRITURE : l'étape
     qui écrit ne doit plus trouver de raison d'échouer, sauf panne
     réseau — et ce cas-là est dit à l'écran (voir plus bas). */
  if (!currentPassword) {
    return { error: "Confirmez avec votre mot de passe actuel pour enregistrer." };
  }

  const supabase = await createClient();
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchantProfile) return { error: "Vous devez être connecté en tant que commerçant." };

  /* LA CONFIRMATION PAR MOT DE PASSE, ET CE QU'ELLE PROTÈGE
     Adresse et WhatsApp sont ce qu'un client lit avant de se déplacer :
     un téléphone déverrouillé emprunté quelques secondes suffisait à les
     réécrire et à détourner les acheteurs d'une boutique. Le mot de passe
     redemandé au moment d'écrire distingue « cette session est ouverte »
     de « c'est bien la bonne personne ».

     Supabase n'a pas d'appel « vérifie ce mot de passe » : il faut s'en
     servir pour se connecter. `passwordIsValid` le fait avec un client
     JETABLE, sans cookie (voir `src/lib/supabase/verify.ts`) — sinon une
     faute de frappe déconnecterait au milieu du formulaire. */
  const user = await getSessionUser(supabase);
  if (!user?.email) {
    // Aucun compte du projet ne devrait être dans ce cas — l'inscription
    // passe toujours par un email. On refuse plutôt que d'enregistrer sans
    // avoir pu vérifier quoi que ce soit.
    return { error: "Impossible de vérifier votre mot de passe. Reconnectez-vous, puis réessayez." };
  }

  if (!(await passwordIsValid(user.email, currentPassword))) {
    // Message volontairement sec : il ne dit rien de plus que « ce n'est
    // pas le bon ». Et il dit ce qui compte pour la personne — que rien
    // n'a bougé — plutôt que de la laisser deviner ce qui a été gardé.
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
  // Même raison que le profil client : un `update` écarté par le RLS
  // répond un succès à zéro ligne. Une boutique dont les modifications
  // disparaissent sans message est la panne la plus décourageante pour un
  // commerçant qui vient de tout ressaisir.
  if (!data || data.length === 0) {
    return { error: "Enregistrement impossible. Reconnectez-vous, puis réessayez." };
  }

  /* Retour sur la CONSULTATION, pas sur l'accueil : les deux sorties de
     l'écran d'édition — la flèche qui annule et cet enregistrement —
     mènent là d'où l'on vient, au moment précis où l'on veut relire ce
     qu'on vient d'écrire. */
  redirect("/vendeur/boutique");
}
