import type { Metadata } from "next";
import { EquipeScreen } from "@/components/equipe/EquipeScreen";

export const metadata: Metadata = { title: "Équipe Filloo", robots: { index: false, follow: false } };

export default function ClientEquipePage({ searchParams }: { searchParams: Promise<{ envoye?: string }> }) {
  return <EquipeScreen espace="client" searchParams={searchParams} />;
}
