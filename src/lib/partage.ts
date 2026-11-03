/**
 * Partage le lien de la page produit. La photo, le nom et le prix de
 * l'aperçu (WhatsApp, Facebook, SMS) viennent des balises Open Graph de
 * `generateMetadata` ; le nom de la boutique est dans le texte, l'aperçu
 * ne le montre que pour un produit sans description. Même message que
 * le partage de l'app mobile (`src/lib/partage.ts` de l'app).
 *
 * Utilisé par le bouton de la fiche client ET par la feuille d'actions
 * du commerçant. Le robot qui lit le lien n'est pas connecté : un produit
 * hors catalogue (brouillon, masqué) lui répond « introuvable ».
 *
 * Sans `navigator.share` (la plupart des ordinateurs), le lien est copié.
 * Rend `"copie"` quand c'est le cas, pour que le bouton le dise.
 */
export async function partagerProduit(produit: {
  productId: string;
  title: string;
  price: string;
  shopName: string;
}): Promise<"partage" | "copie"> {
  // L'origine et non `location.href` : l'adresse peut porter `?info=`,
  // et la feuille d'actions du commerçant n'est pas la page produit.
  const url = `${window.location.origin}/produit/${produit.productId}`;
  const text = `${produit.title}, ${produit.price}, chez ${produit.shopName} sur Filloo :`;
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
    } catch {
      // Fermer la feuille de partage lève une erreur : ce n'est pas une panne.
    }
    return "partage";
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
  } catch {
    window.prompt("Copiez ce lien :", url);
    return "partage";
  }
  return "copie";
}
