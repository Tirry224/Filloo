import type { Metadata } from "next";
import { ReponseEquipeScreen } from "@/components/equipe/ReponseEquipeScreen";

export const metadata: Metadata = { title: "Réponse de l'équipe", robots: { index: false, follow: false } };

export default function ClientEquipeReponsePage({ params }: { params: Promise<{ id: string }> }) {
  return <ReponseEquipeScreen espace="client" params={params} />;
}
