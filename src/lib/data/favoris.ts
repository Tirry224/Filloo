import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Merchant } from "@/lib/types";
import { shopPhotoUrl } from "@/lib/storage";

/**
 * Les boutiques favorites d'un client (table `favoris`, 0077). Le RLS ne
 * laisse lire que MES lignes, et `merchants` ne rend que les boutiques
 * visibles : une boutique suspendue ou fermée depuis l'ajout disparaît
 * de la liste sans être retirée des favoris (elle revient si elle rouvre).
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
