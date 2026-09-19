import { InformationsScreen } from "@/components/auth/InformationsScreen";

/**
 * Montage CLIENT de « Mes informations ». Le fichier ne contient que ce
 * montage, comme les deux montages des conditions d'utilisation : les
 * champs sont partagés, le chemin de retour ne l'est pas.
 *
 * La ville de résidence n'apparaît que sur ce montage-ci : elle vit dans
 * `profiles.city_id` (migration `0010`) et n'a de sens que pour un
 * client. La ville d'un commerçant est celle de sa BOUTIQUE, elle est
 * dans `merchants.city_id` et se modifie sur `/vendeur/boutique/modifier`.
 */
export default function ClientProfilePage() {
  return <InformationsScreen espace="client" />;
}
