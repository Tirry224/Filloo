import type { Metadata } from "next";
import { ReponseEquipeScreen } from "@/components/equipe/ReponseEquipeScreen";

export const metadata: Metadata = { title: "Réponse de l'équipe", robots: { index: false, follow: false } };

export default function MerchantEquipeReponsePage({ params }: { params: Promise<{ id: string }> }) {
  return <ReponseEquipeScreen espace="merchant" params={params} />;
}
