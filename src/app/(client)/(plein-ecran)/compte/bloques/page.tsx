import { BlockedPeopleScreen } from "@/components/auth/BlockedPeopleScreen";

export default function ClientBlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; info?: string }>;
}) {
  return <BlockedPeopleScreen espace="client" searchParams={searchParams} />;
}
