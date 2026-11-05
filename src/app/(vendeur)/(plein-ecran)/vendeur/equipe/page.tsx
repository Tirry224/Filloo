import type { Metadata } from "next";
import { EquipeScreen } from "@/components/equipe/EquipeScreen";

export const metadata: Metadata = { title: "Équipe Filloo", robots: { index: false, follow: false } };

export default function MerchantEquipePage({ searchParams }: { searchParams: Promise<{ erreur?: string; repondre?: string }> }) {
  return <EquipeScreen espace="merchant" searchParams={searchParams} />;
}
