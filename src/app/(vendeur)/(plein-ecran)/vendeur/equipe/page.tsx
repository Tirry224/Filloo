import type { Metadata } from "next";
import { NotificationsEquipeScreen } from "@/components/equipe/NotificationsEquipeScreen";

export const metadata: Metadata = { title: "Équipe Filloo", robots: { index: false, follow: false } };

export default function MerchantEquipeNotificationsPage() {
  return <NotificationsEquipeScreen espace="merchant" />;
}
