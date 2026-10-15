import type { Metadata } from "next";
import { PrivacyScreen } from "@/components/legal/PrivacyScreen";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Comment Filloo traite vos données personnelles.",
};

export default function ClientPrivacyPage() {
  return <PrivacyScreen backHref="/compte" />;
}
