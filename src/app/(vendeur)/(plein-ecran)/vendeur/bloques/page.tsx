import { BlockedPeopleScreen } from "@/components/auth/BlockedPeopleScreen";

/** Garde héritée de `(vendeur)/layout.tsx`. */
export default function MerchantBlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; info?: string }>;
}) {
  return <BlockedPeopleScreen espace="merchant" searchParams={searchParams} />;
}
