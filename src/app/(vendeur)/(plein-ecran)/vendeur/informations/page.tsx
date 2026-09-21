import { InformationsScreen } from "@/components/auth/InformationsScreen";

/**
 * Montage COMMERÇANT de « Mes informations » — sans cette route, nom et
 * téléphone ne se corrigent que depuis `/compte/informations`, réservé à
 * un profil client.
 *
 * Ne se modifie PAS ici : nom, adresse, WhatsApp et ville de la BOUTIQUE,
 * qui vivent sur `/vendeur/boutique/modifier`. « Qui êtes-vous » ici, « où
 * vous trouve-t-on » là-bas.
 *
 * Garde héritée de `(vendeur)/layout.tsx`.
 */
export default function MerchantProfilePage() {
  return <InformationsScreen espace="merchant" />;
}
