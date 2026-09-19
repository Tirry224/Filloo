import { InformationsScreen } from "@/components/auth/InformationsScreen";

/**
 * Montage COMMERÇANT de « Mes informations ».
 *
 * CETTE ROUTE EST LA CORRECTION, pas un confort. Le nom et le téléphone
 * de la personne n'étaient modifiables que depuis `/compte/informations`,
 * réservé à un profil client : un commerçant sans compte lié ne pouvait
 * donc jamais les corriger, et un commerçant qui en avait un les
 * corrigeait sur son seul profil client — l'autre gardait indéfiniment ce
 * qu'il avait tapé à l'inscription.
 *
 * CE QUI NE SE MODIFIE PAS ICI : le nom de la boutique, son adresse, son
 * numéro WhatsApp et sa ville. Ce sont les informations de la BOUTIQUE,
 * pas de la personne — un client les lit avant de se déplacer — et elles
 * vivent sur `/vendeur/boutique/modifier`. Les deux écrans se ressemblent
 * mais ne répondent pas à la même question : « qui êtes-vous » ici, « où
 * vous trouve-t-on » là-bas.
 *
 * Elle hérite de la garde de `(vendeur)/layout.tsx`, comme tout cet
 * espace : `requireMerchantSpace` a déjà refusé l'entrée à une connexion
 * sans profil commerçant actif.
 */
export default function MerchantProfilePage() {
  return <InformationsScreen espace="merchant" />;
}
