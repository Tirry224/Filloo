import { TermsScreen } from "@/components/legal/TermsScreen";

/**
 * Montage COMMERÇANT des conditions d'utilisation. Même texte, retour
 * vers `/vendeur/boutique` — un commerçant qui lit les conditions ne doit
 * pas se retrouver dans son espace d'acheteur en appuyant sur retour.
 */
export default function MerchantTermsPage() {
  return <TermsScreen backHref="/vendeur/boutique" />;
}
