/**
 * « 450 000 GNF », avec une espace insécable ordinaire : l'espace fine
 * d'`Intl` est si étroite sur un téléphone que « 450 000 » se lit
 * « 450000 » (même règle que `formatGnf` du site). Écrit à la main
 * plutôt qu'avec `Intl`, dont le support varie selon le moteur JS.
 */
export function formatGnf(montant: number): string {
  return String(Math.trunc(montant)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " GNF";
}

/**
 * Lien WhatsApp d'un numéro guinéen stocké sans indicatif (9 chiffres
 * commençant par 6). Recopié de `lienWhatsApp` du site : sans le « 224 »,
 * l'adresse est bien formée mais ne désigne aucun compte.
 */
export function lienWhatsApp(numero: string | null): string | null {
  if (!numero) return null;
  const nettoye = numero.replace(/[\s.\-()]/g, "").replace(/^\+224/, "").replace(/^00224/, "");
  return /^6\d{8}$/.test(nettoye) ? `https://wa.me/224${nettoye}` : null;
}

/** « 622 33 44 55 » pour un numéro de 9 chiffres ; tel quel sinon (comme `formatPhone` du site). */
export function formatTelephone(brut: string): string {
  const c = brut.replace(/\D/g, "");
  if (c.length !== 9) return brut;
  return `${c.slice(0, 3)} ${c.slice(3, 5)} ${c.slice(5, 7)} ${c.slice(7)}`;
}
