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
  /* Le modèle ajoute la marque au titre de chaque page (« Robe en wax —
     250 000 GNF · Filloo ») ; `default` sert à l'accueil et aux pages
     sans titre propre. */
  title: {
    default: "Filloo — La mode en Guinée : vêtements, chaussures et accessoires",
    template: "%s · Filloo",
  },
  description:
    "Filloo, la mode en Guinée : vêtements, chaussures et accessoires pour femme, homme et enfant, vendus par les boutiques près de chez vous. Filtrez par taille, couleur et prix, puis contactez le vendeur.",
  /* `apple-touch-icon` est le SEUL format qu'iOS lit pour l'écran
     d'accueil, les icônes du manifeste étant ignorées. Sans lui,
     l'application installée porte une capture de la page — et sur iPhone
     l'installation est la condition pour recevoir un push. */
  appleWebApp: { capable: true, title: "Filloo", statusBarStyle: "default" },
  icons: { apple: "/icons/icone-180.png" },
  /* Preuve de propriété pour Google Search Console (méthode « balise
     HTML ») : le code donné par la console va dans cette variable sur
     Vercel. Absente, aucune balise n'est écrite. La méthode DNS
     (« propriété de domaine ») s'en passe entièrement. */
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION.trim() }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: "#f1f5fa",
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
