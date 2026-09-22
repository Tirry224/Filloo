import { PrivacyScreen } from "@/components/legal/PrivacyScreen";

/**
 * Montage CLIENT de la politique de confidentialité. Comme pour les
 * conditions : le texte est partagé, le chemin de retour ne l'est pas.
 */
export default function ClientPrivacyPage() {
  return <PrivacyScreen backHref="/compte" />;
}
