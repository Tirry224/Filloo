"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
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

  const supabase = await createClient();
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchantProfile) return { error: "Vous devez d'abord créer un compte commerçant." };

  const { error } = await supabase.from("merchants").insert({
    profile_id: merchantProfile.id,
    shop_name: shopName,
    city_id: cityId,
    address_hint: addressHint || null,
    whatsapp_phone: whatsappPhone || null,
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
 *
 * C'est la flèche qui manquait au parcours « refusée → correction →
 * renvoi → attente » : corriger ses informations n'a JAMAIS changé
 * `merchants.status`, donc une boutique refusée le restait indéfiniment
 * quoi que son propriétaire corrige.
 *
 * Le statut n'est pas écrit ici : il l'est par `resubmit_my_merchant()`
 * (0015), en base, qui n'autorise qu'une seule transition
 * ('rejected' → 'pending') et seulement sur la boutique de la connexion
 * qui appelle. Le commerçant n'a toujours aucun droit d'écriture sur
 * `merchants.status` — s'auto-valider reste impossible, et c'est bien la
 * base qui le garantit, pas cet écran.
 *
 * Une `<form>` de composant serveur, sans `useActionState` : comme les
 * actions produit, elle fonctionne sans JavaScript, et son message
 * d'erreur voyage donc dans l'URL, lu par `Notice` sur `/vendeur/refusee`.
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

  if (!shopName || !cityId) {
    return { error: "Le nom de la boutique et la ville sont obligatoires." };
  }

  const supabase = await createClient();
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchantProfile) return { error: "Vous devez être connecté en tant que commerçant." };

  const { data, error } = await supabase
    .from("merchants")
    .update({
      shop_name: shopName,
      city_id: cityId,
      address_hint: addressHint || null,
      whatsapp_phone: whatsappPhone || null,
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

  /* Retour sur la CONSULTATION, pas sur l'accueil. C'est la règle que
     l'écran d'édition pose : ses deux sorties — la flèche retour qui
     annule, et cet enregistrement — mènent au même endroit, celui d'où
     l'on vient. Renvoyer ailleurs obligerait à retrouver son écran pour
     vérifier ce qu'on vient d'écrire, et c'est précisément le moment où
     l'on veut le relire. */
  redirect("/vendeur/boutique");
}
