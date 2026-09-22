import { PrivacyScreen } from "@/components/legal/PrivacyScreen";

/**
 * Montage COMMERÇANT de la politique de confidentialité. Retour vers
 * `/vendeur/boutique` : un commerçant qui la lit ne doit pas atterrir
 * dans son espace d'acheteur en appuyant sur retour.
 */
export default function MerchantPrivacyPage() {
  return <PrivacyScreen backHref="/vendeur/boutique" prefixe="/vendeur" />;
}
