import type { Metadata } from "next";
import { ConversationEquipeScreen } from "@/components/equipe/ConversationEquipeScreen";

export const metadata: Metadata = { title: "Conversation avec l'équipe", robots: { index: false, follow: false } };

export default function ClientEquipeConversationPage({ searchParams }: { searchParams: Promise<{ envoye?: string }> }) {
  return <ConversationEquipeScreen espace="client" searchParams={searchParams} />;
}
