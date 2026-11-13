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
    /* Moins de 60 caractères, moins de 160 pour la description : au-delà,
       Google coupe l'affichage par « … » (audit SEO du 2026-11-12). */
    default: "Filloo — Vêtements, chaussures et accessoires en Guinée",
    template: "%s · Filloo",
  },
  description:
    "Vêtements en Guinée pour femme, homme et enfant, chaussures et accessoires, vendus par des boutiques locales. Trouvez votre taille et contactez le vendeur.",
  /* `apple-touch-icon` est le SEUL format qu'iOS lit pour l'écran
     d'accueil, les icônes du manifeste étant ignorées. Sans lui,
     l'application installée porte une capture de la page — et sur iPhone
     l'installation est la condition pour recevoir un push. Il est servi
     par `app/apple-icon.png` (convention de fichiers) : déclarer `icons`
     ici masquait les favicons `app/icon1.svg` et `app/icon2.png`
     (constaté au build le 2026-11-13). */
  appleWebApp: { capable: true, title: "Filloo", statusBarStyle: "default" },
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
