import type { Metadata } from "next";
import { ConversationEquipeScreen } from "@/components/equipe/ConversationEquipeScreen";

export const metadata: Metadata = { title: "Conversation avec l'équipe", robots: { index: false, follow: false } };

export default function MerchantEquipeConversationPage({ searchParams }: { searchParams: Promise<{ envoye?: string }> }) {
  return <ConversationEquipeScreen espace="merchant" searchParams={searchParams} />;
}
