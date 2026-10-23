import { DeleteAccountScreen } from "@/components/auth/DeleteAccountScreen";

/** Supprime le compte CLIENT seulement ; la boutique a sa propre route,
 *  `/vendeur/informations/supprimer`. */
export default async function ConfirmDeleteClientAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  return <DeleteAccountScreen espace="client" erreur={erreur} />;
}
