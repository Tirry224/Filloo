import type { Metadata } from "next";
import { MessageEquipeScreen } from "@/components/equipe/MessageEquipeScreen";

export const metadata: Metadata = { title: "Votre message", robots: { index: false, follow: false } };

export default function ClientEquipeMessagePage({ params }: { params: Promise<{ id: string }> }) {
  return <MessageEquipeScreen espace="client" params={params} />;
}
