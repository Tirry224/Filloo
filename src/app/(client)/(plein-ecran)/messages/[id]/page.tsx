import { ThreadScreen } from "@/components/chat/ThreadScreen";

export default async function ClientThreadPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ produit?: string; erreur?: string; info?: string }>;
}) {
  return <ThreadScreen espace="client" {...props} />;
}
