import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Product } from "@/lib/types";
import { productImageUrl } from "@/lib/storage";

type SearchRow = Database["public"]["Functions"]["search_products"]["Returns"][number];

/**
 * Traduit une ligne de `search_products` (snake_case) vers le type
 * `Product` que lisent les écrans (camelCase). Seul endroit qui connaît
 * les deux formes, donc seul à corriger si la fonction SQL change.
 */
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

/**
 * Fil d'accueil et recherche partagent la même fonction SQL
 * (0003_search_and_seed.sql), donc le même point d'entrée ici.
 *
 * `cityId` est obligatoire pour toute liste AFFICHÉE : il n'y a pas de fil
 * « toutes villes » (décision 9 de docs/SPEC.md). Omis, il ne sert qu'à
 * CHIFFRER un résultat vide (« 3 produits ailleurs »).
 */
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

/**
 * Fiche produit (écrans 7, 8, 9). Deux requêtes plutôt qu'un embed
 * `product_images(...)` : une fiche ne se consulte jamais en liste, donc
 * l'aller-retour de plus est invisible ici.
 */
export async function getProduct(supabase: SupabaseClient<Database>, id: string): Promise<Product | null> {
  const [{ data: row, error }, { data: images }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, title, description, price_gnf, is_negotiable, status, is_featured, contact_count, categories(name), merchants(id, shop_name, address_hint, whatsapp_phone, cities(name))",
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

/** Compte les résultats sans filtre de ville, pour chiffrer un écran vide
 * (« N produits ailleurs ») — jamais pour les lister : la décision 9 de
 * docs/SPEC.md interdit tout filtrage automatique. */
export async function countProductsElsewhere(
  supabase: SupabaseClient<Database>,
  opts: { query?: string; categoryId?: number | null },
): Promise<number> {
  const { data, error } = await supabase.rpc("search_products", {
    p_query: opts.query || undefined,
    p_category_id: opts.categoryId ?? undefined,
    p_limit: 500,
  });
  if (error) throw error;
  return data.length;
}
