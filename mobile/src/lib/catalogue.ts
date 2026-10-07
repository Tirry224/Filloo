import type { Database } from "./database.types";
import { supabase } from "./supabase";

/**
 * Lecture du catalogue : mêmes requêtes que `src/lib/data/products.ts` du
 * site. Tout passe par le RLS : un produit masqué, en brouillon ou d'une
 * boutique suspendue n'arrive jamais ici.
 */

export type Statut = Database["public"]["Enums"]["product_status"];
export type Option = { id: number; name: string };

export type Boutique = {
  id: string;
  nom: string;
  ville: string;
  adresse: string | null;
  /** `null` dans une liste : `search_products` ne le remonte pas. */
  whatsapp: string | null;
  photoUrl: string | null;
};

export type Produit = {
  id: string;
  titre: string;
  description: string | null;
  prixGnf: number;
  negociable: boolean;
  statut: Statut;
  aLaUne: boolean;
  categorie: string;
  boutique: Boutique;
  photos: string[];
};

export const VILLE_PAR_DEFAUT = "Conakry";

/** Plafond dur de `search_products` (0007) : demander plus ne ramène rien de plus. */
const PLAFOND = 50;

const urlStockage = process.env.EXPO_PUBLIC_SUPABASE_URL;
const photoProduit = (chemin: string) => `${urlStockage}/storage/v1/object/public/product-images/${chemin}`;
const photoBoutique = (chemin: string) => `${urlStockage}/storage/v1/object/public/shop-photos/${chemin}`;

export async function lireVilles(): Promise<Option[]> {
  const { data, error } = await supabase.from("cities").select("id, name").order("position");
  if (error) throw error;
  return data;
}

export async function lireCategories(): Promise<Option[]> {
  const { data, error } = await supabase.from("categories").select("id, name").order("position");
  if (error) throw error;
  return data;
}

/** La ville du compte client s'il y en a un, sinon Conakry. Jamais devinée autrement (décision 9 de SPEC). */
export async function lireVilleDuCompte(authUserId: string | undefined): Promise<number | null> {
  if (!authUserId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("city_id")
    .eq("auth_user_id", authUserId)
    .eq("role", "client")
    .maybeSingle();
  return data?.city_id ?? null;
}

export async function chercherProduits(opts: {
  villeId: number;
  categorieId: number | null;
  tri: "recent" | "popular";
}): Promise<Produit[]> {
  const { data, error } = await supabase.rpc("search_products", {
    p_city_id: opts.villeId,
    p_category_id: opts.categorieId ?? undefined,
    p_sort: opts.tri,
    p_limit: PLAFOND,
  });
  if (error) throw error;
  return data.map((r) => ({
    id: r.product_id,
    titre: r.title,
    description: null,
    prixGnf: r.price_gnf,
    negociable: r.is_negotiable,
    statut: r.status,
    aLaUne: r.is_featured,
    categorie: r.category_name,
    boutique: {
      id: r.merchant_id,
      nom: r.shop_name,
      ville: r.city_name,
      adresse: null,
      whatsapp: null,
      photoUrl: r.shop_photo_path ? photoBoutique(r.shop_photo_path) : null,
    },
    /* Les types déclarent `image_path` non nul, mais la jointure est un
       LEFT JOIN : un produit sans photo renvoie NULL. */
    photos: r.image_path ? [photoProduit(r.image_path)] : [],
  }));
}

type LigneProduit = {
  id: string;
  title: string;
  description: string | null;
  price_gnf: number;
  is_negotiable: boolean;
  status: Statut;
  is_featured: boolean;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function lireProduit(id: string): Promise<Produit | null> {
  /* Un identifiant mal formé ferait répondre PostgreSQL 22P02 : on le
     traite comme « introuvable ». */
  if (!UUID.test(id)) return null;
  const [{ data: ligne, error }, { data: images }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, title, description, price_gnf, is_negotiable, status, is_featured, categories(name), merchants(id, shop_name, address_hint, whatsapp_phone, photo_path, cities(name))",
      )
      .eq("id", id)
      .maybeSingle<LigneProduit>(),
    supabase.from("product_images").select("storage_path, position").eq("product_id", id).order("position"),
  ]);
  if (error) throw error;
  /* Un produit sans sa boutique n'est pas une fiche : « contacter »
     partirait vers un identifiant vide. */
  if (!ligne?.merchants) return null;
  const m = ligne.merchants;
  return {
    id: ligne.id,
    titre: ligne.title,
    description: ligne.description,
    prixGnf: ligne.price_gnf,
    negociable: ligne.is_negotiable,
    statut: ligne.status,
    aLaUne: ligne.is_featured,
    categorie: ligne.categories?.name ?? "",
    boutique: {
      id: m.id,
      nom: m.shop_name,
      ville: m.cities?.name ?? "",
      adresse: m.address_hint,
      whatsapp: m.whatsapp_phone,
      photoUrl: m.photo_path ? photoBoutique(m.photo_path) : null,
    },
    photos: (images ?? []).map((i) => photoProduit(i.storage_path)),
  };
}
