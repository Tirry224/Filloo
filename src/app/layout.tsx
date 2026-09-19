import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "@/styles/index.css";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

/**
 * Next héberge les polices lui-même : le navigateur ne contacte jamais
 * Google au chargement. C'est une question de vitesse — un aller-retour
 * réseau de moins sur une connexion mobile lente — et de vie privée.
 *
 * `variable` publie chaque police comme variable CSS, que tokens.css
 * récupère dans --font-sans et --font-display. Les composants ne
 * connaissent donc jamais le nom d'une police.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display-src",
  display: "swap",
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Makiti — Trouvez des produits et des commerçants près de chez vous",
  description:
    "Makiti aide à trouver des produits et les commerçants qui les vendent, en Guinée. Parcourez le catalogue librement et contactez le vendeur pour conclure la vente.",
};

export const viewport: Viewport = {
  themeColor: "#fdfbf7",
  /* `maximum-scale` n'est pas verrouillé : empêcher le zoom rend
     l'application inutilisable pour qui voit mal. */
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      {/* Le bandeau est posé DANS le layout racine, avant tout le reste :
          une coupure de réseau ne choisit pas sa page, et le répéter dans
          chaque espace serait une garde de plus à oublier. Il ne rend rien
          tant que la connexion tient, donc il ne coûte rien au cas
          normal. */}
      <body>
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
