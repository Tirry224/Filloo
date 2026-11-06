import type { Metadata } from "next";
import { DiscussionEquipeScreen } from "@/components/equipe/DiscussionEquipeScreen";

export const metadata: Metadata = { title: "Discussion avec l'équipe", robots: { index: false, follow: false } };

export default function ClientEquipeDiscussionPage({ searchParams }: { searchParams: Promise<{ ecrire?: string }> }) {
  return <DiscussionEquipeScreen espace="client" searchParams={searchParams} />;
}
