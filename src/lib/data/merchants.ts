import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Merchant, Product } from "@/lib/types";
import { productImageUrl, shopPhotoUrl } from "@/lib/storage";
import { getMyProfile } from "@/lib/data/session";
import { estUuid } from "@/lib/saisie";

type MerchantRow = {
  id: string;
  shop_name: string;
  description: string | null;
  address_hint: string | null;
  whatsapp_phone: string | null;
  photo_path: string | null;
  status: Database["public"]["Enums"]["merchant_status"];
  rejection_reason: string | null;
  cities: { name: string } | null;
};

function mapMerchant(row: MerchantRow): Merchant {
  return {
    id: row.id,
    shopName: row.shop_name,
    description: row.description,
    city: row.cities?.name ?? "",
    addressHint: row.address_hint,
    whatsappPhone: row.whatsapp_phone,
    photoUrl: row.photo_path ? shopPhotoUrl(row.photo_path) : null,
    status: row.status,
    rejectionReason: row.rejection_reason,
  };
}

/**
 * Boutique publique (écran 11). Le RLS ne laisse lire qu'une boutique
 * `approved` : en attente ou refusée, elle renvoie `null`, comme si elle
 * n'existait pas — un visiteur n'a pas à savoir qu'elle attend.
 */
export async function getMerchant(supabase: SupabaseClient<Database>, id: string): Promise<Merchant | null> {
  // Voir `estUuid` : un identifiant mal formé est une page introuvable.
  if (!estUuid(id)) return null;
  const { data, error } = await supabase
    .from("merchants")
    .select("id, shop_name, description, address_hint, whatsapp_phone, photo_path, status, rejection_reason, cities(name)")
    .eq("id", id)
    .maybeSingle<MerchantRow>();
  if (error) throw error;
  if (!data) return null;
  return mapMerchant(data);
}

/**
 * La boutique de la connexion active avec son statut RÉEL, contrairement à
 * `getMerchant` : seul son propriétaire a le droit de savoir où elle en
 * est.
 */
export const getMyMerchant = cache(async (supabase: SupabaseClient<Database>): Promise<Merchant | null> => {
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchantProfile) return null;
  const { data, error } = await supabase
    .from("merchants")
    .select("id, shop_name, description, address_hint, whatsapp_phone, photo_path, status, rejection_reason, cities(name)")
    .eq("profile_id", merchantProfile.id)
    .maybeSingle<MerchantRow>();
  if (error) throw error;
  if (!data) return null;
  return mapMerchant(data);
});

type MerchantProductRow = {
  id: string;
  title: string;
  price_gnf: number;
  is_negotiable: boolean;
  status: Database["public"]["Enums"]["product_status"];
  is_featured: boolean;
  contact_count: number;
  categories: { name: string } | null;
  product_images: { storage_path: string; position: number }[];
};

/** Catalogue d'une boutique (écran 11). Le RLS filtre brouillons et
 * produits masqués pour un visiteur, et laisse tout voir au propriétaire :
 * cette fonction sert donc aussi à « Mes produits » (écran 22). */
export async function getMerchantProducts(
  supabase: SupabaseClient<Database>,
  merchant: Merchant,
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, title, price_gnf, is_negotiable, status, is_featured, contact_count, categories(name), product_images(storage_path, position)",
    )
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false })
    .returns<MerchantProductRow[]>();
  if (error) throw error;
  return data.map((row) => {
    const cover = [...row.product_images].sort((a, b) => a.position - b.position)[0];
    return {
      id: row.id,
      merchant: {
        id: merchant.id,
        shopName: merchant.shopName,
        city: merchant.city,
        addressHint: merchant.addressHint,
        whatsappPhone: merchant.whatsappPhone,
        photoUrl: merchant.photoUrl,
      },
      category: row.categories?.name ?? "",
      title: row.title,
      description: null,
      priceGnf: row.price_gnf,
      isNegotiable: row.is_negotiable,
      status: row.status,
      isFeatured: row.is_featured,
      contactCount: row.contact_count,
      imageUrls: cover ? [productImageUrl(cover.storage_path)] : [],
    };
  });
}
