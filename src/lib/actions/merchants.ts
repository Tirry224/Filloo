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

  redirect("/vendeur");
}
