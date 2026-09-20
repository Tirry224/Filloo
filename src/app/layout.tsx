import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "@/styles/index.css";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { ClosePanels } from "@/components/ui/ClosePanels";
import { ServiceWorkerRegistrar } from "@/components/ui/ServiceWorkerRegistrar";

/**
 * UNE SEULE POLICE, ET C'EST LA DÉCISION R4 DE docs/PERFORMANCE.md.
 *
 * Le projet en chargeait deux : Figtree pour le texte, une seconde pour
 * les titres, les prix et le logotype. Cette seconde pesait 40,3 Ko —
 * DEUX FOIS Figtree (19,7 Ko) — et elle partait au premier chargement,
 * avant que la personne ne voie quoi que ce soit. Sur une connexion
 * facturée au mégaoctet, c'était le poste le plus cher du texte.
 *
 * R4 avait tranché le 2026-09-14 en écrivant « Bricolage est retirée ».
 * Le code ne l'a jamais fait : le document et ce fichier se
 * contredisaient depuis le commit qui les a écrits tous les deux, et
 * `npm run poids` échouait sur le budget polices (60 Ko pour 40) sans que
 * personne ne relie les deux. Appliqué pour de bon le 2026-09-20, après
 * que le porteur du projet a comparé les deux rendus à 400 px.
 *
 * CE QUE L'ÉCART COÛTAIT EN APPARENCE : presque rien. Les titres gardent
 * leur graisse et leur interlettrage resserré (`src/styles/base.css`) ;
 * seul le dessin de la lettre change. Le logotype est ce qui perd le
 * plus, et la différence reste faible à la largeur d'un téléphone.
 *
 * `preload: false` aurait été un faux ami : `scripts/poids.mjs` ne compte
 * que les polices PRÉCHARGÉES, donc le budget serait repassé au vert sans
 * qu'un seul octet cesse d'être téléchargé — simplement plus tard, et
 * après un changement de police visible à l'écran.
 *
 * Next héberge la police lui-même : le navigateur ne contacte jamais
 * Google au chargement. C'est une question de vitesse — un aller-retour
 * réseau de moins — et de vie privée. `variable` la publie comme variable
 * CSS, que tokens.css récupère ; les composants ne connaissent donc
 * jamais le nom d'une police.
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
