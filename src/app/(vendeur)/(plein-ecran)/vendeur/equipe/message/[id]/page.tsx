import type { Metadata } from "next";
import { MessageEquipeScreen } from "@/components/equipe/MessageEquipeScreen";

export const metadata: Metadata = { title: "Votre message", robots: { index: false, follow: false } };

export default function MerchantEquipeMessagePage({ params }: { params: Promise<{ id: string }> }) {
  return <MessageEquipeScreen espace="merchant" params={params} />;
}
