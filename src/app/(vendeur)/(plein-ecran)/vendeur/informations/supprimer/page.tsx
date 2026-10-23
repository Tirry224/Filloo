import { DeleteAccountScreen } from "@/components/auth/DeleteAccountScreen";

/** Supprime la BOUTIQUE seulement ; le compte client lié reste. Garde
 *  héritée de `(vendeur)/layout.tsx`. */
export default async function ConfirmDeleteMerchantAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  return <DeleteAccountScreen espace="merchant" erreur={erreur} />;
}
