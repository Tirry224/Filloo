import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "@/styles/index.css";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { ClosePanels } from "@/components/ui/ClosePanels";
import { ServiceWorkerRegistrar } from "@/components/ui/ServiceWorkerRegistrar";
import { siteUrl } from "@/lib/site-url";

/**
 * UNE SEULE POLICE (R4 de docs/PERFORMANCE.md) : la seconde pesait 40,3 Ko
 * pour une différence à peine visible sur un téléphone. En ajouter une est
 * une décision.
 *
 * PIÈGE : `preload: false` remettrait le budget au vert sans économiser un
 * octet, `scripts/poids.mjs` ne comptant que les polices PRÉCHARGÉES — la
 * police arriverait plus tard, avec un saut de lettres visible.
 *
 * Next l'héberge lui-même, donc aucun appel à Google ; `variable` la publie
 * en variable CSS que tokens.css récupère.
 */

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

     C'est le canal de diffusion principal de Makiti en Guinée : un produit
     se partage dans une conversation WhatsApp, pas depuis un moteur de
     recherche. Un aperçu vide y coûte plus qu'un mauvais référencement.

     `null` quand aucune adresse n'est configurée : Next se contente alors
     des balises relatives, comme avant — on ne devine pas un domaine. */
  metadataBase: adresse ? new URL(adresse) : null,
  title: "Makiti — Trouvez des produits et des commerçants près de chez vous",
  description:
    "Makiti aide à trouver des produits et les commerçants qui les vendent, en Guinée. Parcourez le catalogue librement et contactez le vendeur pour conclure la vente.",
  /* `apple-touch-icon` est le SEUL format qu'iOS lit pour l'écran
     d'accueil, les icônes du manifeste étant ignorées. Sans lui,
     l'application installée porte une capture de la page — et sur iPhone
     l'installation est la condition pour recevoir un push. */
  appleWebApp: { capable: true, title: "Makiti", statusBarStyle: "default" },
  icons: { apple: "/icons/icone-180.png" },

  /* PAS d'`openGraph` ICI, et c'est un arbitrage mesuré, pas un oubli.
     Des balises posées à la racine sont recopiées dans le `<head>` de
     CHAQUE écran : `og:type` et `og:site_name` seuls coûtaient 0,2 Ko par
     page et faisaient passer `/conditions` de 12,0 à 12,2 Ko, au-dessus
     du budget de `npm run poids`. Or elles n'ajoutaient rien à l'aperçu :
     sans `og:title`, WhatsApp et Facebook retombent sur `<title>` et
     `<meta name="description">`, qui sont déjà là.

     Le partage se joue sur DEUX écrans — la fiche produit et la fiche
     boutique — et c'est là que les balises complètes sont posées, image
     comprise (`generateMetadata`). Payer sur trente-huit écrans ce qui
     n'en sert que deux était le mauvais sens du calcul.

     `metadataBase` reste, lui : il n'écrit aucune balise par lui-même, il
     donne seulement à ces deux écrans l'origine dont ils ont besoin pour
     produire une URL d'image absolue. */

};

export const viewport: Viewport = {
  themeColor: "#fdfbf7",
  /* `maximum-scale` n'est pas verrouillé : empêcher le zoom rend
     l'application inutilisable pour qui voit mal. */
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={body.variable}>
      {/* Le bandeau est posé DANS le layout racine, avant tout le reste :
          une coupure de réseau ne choisit pas sa page, et le répéter dans
          chaque espace serait une garde de plus à oublier. Il ne rend rien
          tant que la connexion tient, donc il ne coûte rien au cas
          normal. */}
      <body>
        <OfflineBanner />
        {children}
        {/* Un seul écouteur pour tous les panneaux de filtre de l'app :
            les refermer au tap extérieur est un confort, jamais une
            condition de leur fonctionnement. */}
        <ClosePanels />
        {/* Le service worker ne sert QU'aux notifications : il ne met
            rien en cache (voir `public/sw.js`). Il s'installe sans rien
            demander ; la permission de notifier se demandera ailleurs, au
            moment où la personne l'activera. */}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
