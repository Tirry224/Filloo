/**
 * Adresse publique d'une photo de produit, construite localement — pas un
 * appel réseau. Le bucket `product-images` est public en lecture
 * (0004_storage.sql) ; cette fonction ne fait que suivre la convention
 * d'URL de Supabase Storage. Utilisable côté serveur ET côté navigateur
 * (PhotoPicker), contrairement à `supabase.storage...getPublicUrl()` qui
 * demande un client déjà construit pour ne faire, au fond, que ça.
 */
export function productImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

/**
 * Adresse publique de la photo d'une boutique. Bucket À PART de
 * `product-images` (0029) : le ménage de 0028 efface tout fichier de
 * `product-images` qu'aucun produit ne cite, photo de boutique comprise.
 */
export function shopPhotoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${SHOP_PHOTOS_BUCKET}/${path}`;
}

export const SHOP_PHOTOS_BUCKET = "shop-photos";

/** Borne tenue par `product_images_position_check` (0026). */
export const PHOTOS_MAX = 5;
