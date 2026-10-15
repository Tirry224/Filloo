import type { Metadata } from "next";
import { ContactScreen } from "@/components/legal/ContactScreen";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contacter l'équipe de Filloo.",
};

export default function ClientContactPage() {
  return <ContactScreen backHref="/compte" />;
}
