/**
 * Le montant est un ENTIER de francs, jamais un nombre à virgule : on ne
 * représente pas de l'argent avec un flottant (voir le commentaire de
 * `products.price_gnf` dans la migration 0001).
 */
export function formatGnf(amount: number): string {
  return (
    new Intl.NumberFormat("fr-FR")
      .format(amount)
      /* Intl sépare les milliers par une espace FINE insécable (U+202F),
         si étroite sur un téléphone que « 450 000 » se lit « 450000 ». On
         la remplace par une insécable ordinaire (U+00A0) : visible, et le
         montant ne se coupe toujours pas en fin de ligne. */
      .replace(/\u202F/g, "\u00A0") + "\u00A0GNF"
  );
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 9) return raw;
  return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
}

export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
