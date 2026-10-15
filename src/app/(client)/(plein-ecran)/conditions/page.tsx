import type { Metadata } from "next";
import { TermsScreen } from "@/components/legal/TermsScreen";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Les conditions d'utilisation de Filloo.",
};

export default function ClientTermsPage() {
  return <TermsScreen backHref="/compte" />;
}
