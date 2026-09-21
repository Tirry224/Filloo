import { InformationsScreen } from "@/components/auth/InformationsScreen";

/**
 * Montage CLIENT de « Mes informations » : les champs sont partagés, le
 * chemin de retour ne l'est pas.
 *
 * La ville de résidence n'apparaît que sur ce montage — `profiles.city_id`
 * (migration `0010`) n'a de sens que pour un client. La ville d'un
 * commerçant est celle de sa BOUTIQUE (`merchants.city_id`), modifiable
 * sur `/vendeur/boutique/modifier`.
 */
export default function ClientProfilePage() {
  return <InformationsScreen espace="client" />;
}
