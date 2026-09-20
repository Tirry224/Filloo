import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "@/styles/index.css";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { ClosePanels } from "@/components/ui/ClosePanels";
import { ServiceWorkerRegistrar } from "@/components/ui/ServiceWorkerRegistrar";

/**
 * UNE SEULE POLICE (R4 de docs/PERFORMANCE.md, qui raconte l'histoire).
 * La seconde, réservée aux titres et au logotype, pesait 40,3 Ko — deux
 * fois celle-ci — pour une différence à peine visible à la largeur d'un
 * téléphone. En ajouter une redevient une décision, pas un réflexe.
 *
 * PIÈGE À NE PAS RETOMBER DEDANS : `preload: false` remettrait le budget
 * au vert sans qu'un seul octet cesse d'être téléchargé, puisque
 * `scripts/poids.mjs` ne compte que les polices PRÉCHARGÉES. La police
 * arriverait simplement plus tard, après un changement de lettres visible.
 *
 * Next l'héberge lui-même : aucun appel à Google au chargement. `variable`
 * la publie comme variable CSS, que tokens.css récupère ; les composants
 * ne connaissent jamais le nom d'une police.
 */

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body-src",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Makiti — Trouvez des produits et des commerçants près de chez vous",
  description:
    "Makiti aide à trouver des produits et les commerçants qui les vendent, en Guinée. Parcourez le catalogue librement et contactez le vendeur pour conclure la vente.",
  /* `apple-touch-icon` est le SEUL format qu'iOS lit pour l'écran
     d'accueil : il ignore les icônes du manifeste. Sans cette ligne,
     l'application installée depuis un iPhone porterait une capture de la
     page au lieu du logo — et sur iPhone, l'installation est justement la
     condition pour recevoir un push. */
  appleWebApp: { capable: true, title: "Makiti", statusBarStyle: "default" },
  icons: { apple: "/icons/icone-180.png" },
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
