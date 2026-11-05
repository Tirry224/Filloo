import type { Metadata } from "next";
import { EcrireEquipeScreen } from "@/components/equipe/EcrireEquipeScreen";

export const metadata: Metadata = { title: "Écrire à l'équipe", robots: { index: false, follow: false } };

export default function ClientEquipeEcrirePage({ searchParams }: { searchParams: Promise<{ repondre?: string; depuis?: string }> }) {
  return <EcrireEquipeScreen espace="client" searchParams={searchParams} />;
}
