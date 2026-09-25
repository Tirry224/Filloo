import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Product } from "@/lib/types";
import { productImageUrl, shopPhotoUrl } from "@/lib/storage";
import { estUuid } from "@/lib/saisie";

type SearchRow = Database["public"]["Functions"]["search_products"]["Returns"][number];

function mapRow(row: SearchRow): Product {
  return {
    id: row.product_id,
    merchant: {
      id: row.merchant_id,
      shopName: row.shop_name,
      city: row.city_name,
      addressHint: null,
      // `search_products` ne remonte pas le numéro : nul ici veut dire
      // « non chargé », pas « la boutique n'en a pas ».
      whatsappPhone: null,
      photoUrl: row.shop_photo_path ? shopPhotoUrl(row.shop_photo_path) : null,
    },
    category: row.category_name,
    title: row.title,
    description: null,
    priceGnf: row.price_gnf,
    isNegotiable: row.is_negotiable,
    status: row.status,
    isFeatured: row.is_featured,
    contactCount: row.contact_count,
    /* Les types générés déclarent `image_path` non-nul, mais la jointure
       SQL est un LEFT JOIN : un produit sans photo renvoie NULL. */
    imageUrls: row.image_path ? [productImageUrl(row.image_path)] : [],
  };
}

type ProductDetailRow = {
  id: string;
  title: string;
  description: string | null;
  price_gnf: number;
  is_negotiable: boolean;
  status: Database["public"]["Enums"]["product_status"];
  is_featured: boolean;
  contact_count: number;
  categories: { name: string } | null;
  merchants: {
    id: string;
    shop_name: string;
    address_hint: string | null;
    whatsapp_phone: string | null;
    photo_path: string | null;
    cities: { name: string } | null;
  } | null;
};

function mapDetailRow(row: ProductDetailRow, imageUrls: string[]): Product {
  return {
    id: row.id,
    merchant: {
      id: row.merchants?.id ?? "",
      shopName: row.merchants?.shop_name ?? "",
      city: row.merchants?.cities?.name ?? "",
      addressHint: row.merchants?.address_hint ?? null,
      whatsappPhone: row.merchants?.whatsapp_phone ?? null,
      photoUrl: row.merchants?.photo_path ? shopPhotoUrl(row.merchants.photo_path) : null,
    },
    category: row.categories?.name ?? "",
    title: row.title,
    description: row.description,
    priceGnf: row.price_gnf,
    isNegotiable: row.is_negotiable,
    status: row.status,
    isFeatured: row.is_featured,
    contactCount: row.contact_count,
    imageUrls,
  };
}

export async function getProduct(supabase: SupabaseClient<Database>, id: string): Promise<Product | null> {
  /* `/produit/abc` : sans ce refus, PostgreSQL répond 22P02, relancé
     ci-dessous, et la page devient une erreur 500 au lieu d'un 404. */
  if (!estUuid(id)) return null;
  const [{ data: row, error }, { data: images }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, title, description, price_gnf, is_negotiable, status, is_featured, contact_count, categories(name), merchants(id, shop_name, address_hint, whatsapp_phone, photo_path, cities(name))",
      )
      .eq("id", id)
      .maybeSingle<ProductDetailRow>(),
    supabase
      .from("product_images")
      .select("storage_path, position")
      .eq("product_id", id)
      .order("position"),
  ]);
  if (error) throw error;
  if (!row) return null;
  /* Un produit sans sa boutique n'est pas une fiche produit : sans ce
     refus, `merchant.id` vaut la chaîne vide et « Contacter le vendeur »
     part créer une conversation avec un identifiant inexistant. Le RLS
     rend le cas improbable, ce qui n'est pas une garantie. */
  if (!row.merchants) return null;
  return mapDetailRow(row, (images ?? []).map((i) => productImageUrl(i.storage_path)));
}

export async function searchProducts(
  supabase: SupabaseClient<Database>,
  opts: {
    query?: string;
    cityId?: number;
    categoryId?: number | null;
    sort?: "recent" | "popular";
    limit?: number;
  },
): Promise<Product[]> {
  const { data, error } = await supabase.rpc("search_products", {
    p_query: opts.query || undefined,
    p_city_id: opts.cityId ?? undefined,
    p_category_id: opts.categoryId ?? undefined,
    p_sort: opts.sort ?? "recent",
    p_limit: opts.limit ?? 24,
  });
  if (error) throw error;
  return data.map(mapRow);
}

/**
 * Plafond DUR de `search_products` : la fonction termine par
 * `limit least(coalesce(p_limit, 24), 50)` (0007). Demander davantage ne
 * ramène pas une ligne de plus — c'est ce qui faisait annoncer un chiffre
 * faux quand `countProductsElsewhere` demandait 500.
 */
export const PLAFOND_RESULTATS = 50;

/** Compte les résultats sans filtre de ville, pour chiffrer un écran vide
 * (« N produits ailleurs ») — jamais pour les lister : la décision 9 de
 * docs/SPEC.md interdit tout filtrage automatique.
 *
 * `atteintLePlafond` dit que le compte est une BORNE BASSE, pas un total :
 * au-delà de 50, la base ne sait pas compter plus loin sans une seconde
 * fonction, et l'écran doit écrire « 50 et plus » plutôt qu'un nombre
 * qu'il ne connaît pas.
 */
export async function countProductsElsewhere(
  supabase: SupabaseClient<Database>,
  opts: { query?: string; categoryId?: number | null },
): Promise<{ nombre: number; atteintLePlafond: boolean }> {
  const { data, error } = await supabase.rpc("search_products", {
    p_query: opts.query || undefined,
    p_category_id: opts.categoryId ?? undefined,
    p_limit: PLAFOND_RESULTATS,
  });
  if (error) throw error;
  return { nombre: data.length, atteintLePlafond: data.length >= PLAFOND_RESULTATS };
}
