import { TermsScreen } from "@/components/legal/TermsScreen";

/**
 * Montage CLIENT des conditions d'utilisation. Le fichier ne contient que
 * ce montage, comme les deux montages du fil de discussion : le texte est
 * partagé, le chemin de retour ne l'est pas.
 */
export default function ClientTermsPage() {
  return <TermsScreen backHref="/compte" />;
}
