import type { Metadata } from "next";
import { AnnonceEquipeScreen } from "@/components/equipe/AnnonceEquipeScreen";

export const metadata: Metadata = { title: "Annonce", robots: { index: false, follow: false } };

export default function MerchantEquipeAnnoncePage({ params }: { params: Promise<{ id: string }> }) {
  return <AnnonceEquipeScreen espace="merchant" params={params} />;
}
