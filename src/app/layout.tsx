import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "@/styles/index.css";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { ClosePanels } from "@/components/ui/ClosePanels";
import { ServiceWorkerRegistrar } from "@/components/ui/ServiceWorkerRegistrar";
import { MessageAlerts } from "@/components/chat/MessageAlerts";
import { siteUrl } from "@/lib/site-url";

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body-src",
  display: "swap",
});

const adresse = siteUrl();

export const metadata: Metadata = {
  /* `metadataBase` est la condition pour que les balises Open Graph
     portent une adresse ABSOLUE. Sans elle, Next écrit une image relative
     (`/…`) — et WhatsApp, Facebook et Messenger, qui lisent la page depuis
     leurs propres serveurs, n'ont rien contre quoi la résoudre : le lien
     partagé s'affiche alors sans aperçu, sans photo et sans prix.

     `null` quand aucune adresse n'est configurée : Next se contente alors
     des balises relatives, comme avant — on ne devine pas un domaine. */
  metadataBase: adresse ? new URL(adresse) : null,
  title: "Filloo — Trouvez des produits et des commerçants près de chez vous",
  description:
    "Filloo aide à trouver des produits et les commerçants qui les vendent, en Guinée. Parcourez le catalogue librement et contactez le vendeur pour conclure la vente.",
  /* `apple-touch-icon` est le SEUL format qu'iOS lit pour l'écran
     d'accueil, les icônes du manifeste étant ignorées. Sans lui,
     l'application installée porte une capture de la page — et sur iPhone
     l'installation est la condition pour recevoir un push. */
  appleWebApp: { capable: true, title: "Filloo", statusBarStyle: "default" },
  icons: { apple: "/icons/icone-180.png" },
};

export const viewport: Viewport = {
  themeColor: "#fdfbf7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={body.variable}>
      <body>
        <OfflineBanner />
        {children}
        <ClosePanels />
        <ServiceWorkerRegistrar />
        <MessageAlerts />
      </body>
    </html>
  );
}
