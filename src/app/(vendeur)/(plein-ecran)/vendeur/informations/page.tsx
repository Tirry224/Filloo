import { InformationsScreen } from "@/components/auth/InformationsScreen";

/**
 * Montage COMMERÇANT de « Mes informations ».
 *
 * CETTE ROUTE EST LA CORRECTION, pas un confort : nom et téléphone n'étaient
 * modifiables que depuis `/compte/informations`, réservé à un profil client.
 * Un commerçant sans compte lié ne pouvait jamais les corriger, et celui qui
 * en avait un ne corrigeait que son profil client — l'autre gardait ce qu'il
 * avait tapé à l'inscription.
 *
 * CE QUI NE SE MODIFIE PAS ICI : nom, adresse, WhatsApp et ville de la
 * BOUTIQUE, qui vivent sur `/vendeur/boutique/modifier`. « Qui êtes-vous »
 * ici, « où vous trouve-t-on » là-bas.
 *
 * Garde héritée de `(vendeur)/layout.tsx` : `requireMerchantSpace` a déjà
 * refusé une connexion sans profil commerçant actif.
 */
export default function MerchantProfilePage() {
  return <InformationsScreen espace="merchant" />;
}
