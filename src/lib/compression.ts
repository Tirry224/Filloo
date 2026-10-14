import imageCompression from "browser-image-compression";

/**
 * Durée de cache d'une photo envoyée, en secondes : un an. Un chemin ne
 * sert qu'une fois (identifiant aléatoire, jamais réécrit), donc une
 * photo en cache n'est jamais périmée. Le défaut de Supabase (une heure)
 * faisait retélécharger chaque photo par chaque téléphone, à chaque heure.
 */
export const CACHE_PHOTO = "31536000";

/**
 * Compresse une photo dans le navigateur avant l'envoi, en WebP quand le
 * navigateur sait l'encoder, en JPEG sinon.
 *
 * Safari n'encode pas le WebP dans un canvas : `browser-image-compression`
 * rend alors du PNG sans prévenir — plusieurs fois plus lourd, et refusé
 * par le bucket `shop-photos` (0031). Le JPEG, lui, sort partout.
 *
 * L'extension rendue suit le VRAI format du fichier : c'est elle qui
 * finit dans le chemin, puis dans les contrôles du serveur.
 */
export async function compresserPhoto(
  file: File,
  options: { maxSizeMB: number; maxWidthOrHeight: number },
): Promise<{ fichier: File; extension: "webp" | "jpg" }> {
  const reglages = { ...options, useWebWorker: true };
  const webp = await imageCompression(file, { ...reglages, fileType: "image/webp" });
  if (webp.type === "image/webp") return { fichier: webp, extension: "webp" };
  return { fichier: await imageCompression(file, { ...reglages, fileType: "image/jpeg" }), extension: "jpg" };
}
