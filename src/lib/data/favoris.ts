import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Merchant, Product } from "@/lib/types";
import { productImageUrl, shopPhotoUrl } from "@/lib/storage";

/**
 * Les boutiques favorites d'un client (table `favoris`, 0077). Le RLS ne
 * laisse lire que MES lignes, et `merchants` ne rend que les boutiques
 * que je peux lire : une boutique suspendue depuis l'ajout disparaît de
 * la liste sans être retirée des favoris (elle revient si elle rouvre),
 * SAUF si j'ai un fil avec elle (règle `i_talk_with_merchant`) : elle
 * reste alors, comme sa page reste lisible. Un compte supprimé, lui,
 * emporte ses favoris (déclencheur de 0077).
 */

export async function estFavori(
  supabase: SupabaseClient<Database>,
  clientId: string,
  merchantId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("favoris")
    .select("merchant_id")
    .eq("client_id", clientId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

type FavoriRow = {
  merchants: {
    id: string;
    shop_name: string;
    description: string | null;
    address_hint: string | null;
    whatsapp_phone: string | null;
    photo_path: string | null;
    cities: { name: string } | null;
  } | null;
};

/** Du plus récent au plus ancien ajout. */
export async function getMesFavoris(supabase: SupabaseClient<Database>, clientId: string): Promise<Merchant[]> {
  const { data, error } = await supabase
    .from("favoris")
    .select("merchants(id, shop_name, description, address_hint, whatsapp_phone, photo_path, cities(name))")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .returns<FavoriRow[]>();
  if (error) throw error;
  return data.flatMap(({ merchants: m }) =>
    m
      ? [
          {
            id: m.id,
            shopName: m.shop_name,
            description: m.description,
            city: m.cities?.name ?? "",
            addressHint: m.address_hint,
            whatsappPhone: m.whatsapp_phone,
            photoUrl: m.photo_path ? shopPhotoUrl(m.photo_path) : null,
          },
        ]
      : [],
  );
}

/* ---------------------------------------------------------------------
 * Produits favoris (`favoris_produits`, 0078). Même logique : un produit
 * que le RLS de `products` ne laisse plus lire (masqué, brouillon,
 * boutique suspendue) sort de la liste sans quitter les favoris.
 * ------------------------------------------------------------------- */

export async function estProduitFavori(
  supabase: SupabaseClient<Database>,
  clientId: string,
  productId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("favoris_produits")
    .select("product_id")
    .eq("client_id", clientId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

type ProduitFavoriRow = {
  products: {
    id: string;
    title: string;
    price_gnf: number;
    is_negotiable: boolean;
    status: Database["public"]["Enums"]["product_status"];
    is_featured: boolean;
    contact_count: number;
    categories: { name: string } | null;
    product_images: { storage_path: string; position: number }[];
    merchants: {
      id: string;
      shop_name: string;
      address_hint: string | null;
      whatsapp_phone: string | null;
      photo_path: string | null;
      cities: { name: string } | null;
    } | null;
  } | null;
};

/** Du plus récent au plus ancien ajout ; un produit vendu reste (badge VENDU). */
export async function getMesProduitsFavoris(supabase: SupabaseClient<Database>, clientId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from("favoris_produits")
    .select(
      "products(id, title, price_gnf, is_negotiable, status, is_featured, contact_count, categories(name), product_images(storage_path, position), merchants(id, shop_name, address_hint, whatsapp_phone, photo_path, cities(name)))",
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .returns<ProduitFavoriRow[]>();
  if (error) throw error;
  return data.flatMap(({ products: p }) => {
    /* Le propriétaire (comptes liés) lit aussi ses brouillons et produits
       masqués : la liste ne montre que ce que le public voit. */
    if (!p || !p.merchants || (p.status !== "active" && p.status !== "sold")) return [];
    const m = p.merchants;
    const couverture = [...p.product_images].sort((a, b) => a.position - b.position)[0];
    return [
      {
        id: p.id,
        merchant: {
          id: m.id,
          shopName: m.shop_name,
          city: m.cities?.name ?? "",
          addressHint: m.address_hint,
          whatsappPhone: m.whatsapp_phone,
          photoUrl: m.photo_path ? shopPhotoUrl(m.photo_path) : null,
        },
        category: p.categories?.name ?? "",
        title: p.title,
        description: null,
        priceGnf: p.price_gnf,
        isNegotiable: p.is_negotiable,
        status: p.status,
        isFeatured: p.is_featured,
        contactCount: p.contact_count,
        imageUrls: couverture ? [productImageUrl(couverture.storage_path)] : [],
      },
    ];
  });
}
