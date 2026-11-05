import type { Metadata } from "next";
import { AnnonceEquipeScreen } from "@/components/equipe/AnnonceEquipeScreen";

export const metadata: Metadata = { title: "Annonce", robots: { index: false, follow: false } };

export default function ClientEquipeAnnoncePage({ params }: { params: Promise<{ id: string }> }) {
  return <AnnonceEquipeScreen espace="client" params={params} />;
}
