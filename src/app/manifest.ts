import type { MetadataRoute } from "next";

/**
 * Le manifeste, première pierre des notifications push : sans lui, pas
 * d'« Ajouter à l'écran d'accueil », et sur iPhone Safari n'autorise le
 * push QUE pour une application installée ainsi. C'est la condition
 * d'entrée, pas une coquetterie.
 *
 * Route typée plutôt que `public/manifest.json` : Next la sert avec le
 * bon type MIME et vérifie les champs à la compilation, là où un JSON
 * écrit à la main se tairait sur une faute de frappe.
 *
 * `display: "standalone"` : ouverte sans barre d'adresse, elle ressemble
 * à une application qu'on garde, pas à un site qu'on visite.
 *
 * `start_url: "/"` et non l'écran vendeur : le manifeste ne connaît pas
 * la personne, c'est `landingForSession` qui aiguille.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Makiti — produits et commerçants près de chez vous",
    short_name: "Makiti",
    description:
      "Trouvez des produits et les commerçants qui les vendent, en Guinée. Parcourez le catalogue et contactez le vendeur pour conclure la vente.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    /* Les deux couleurs viennent de `src/styles/tokens.css` : `--color-paper`
       pour le fond, `--color-accent` pour la barre système. Elles sont
       écrites en hexadécimal ici parce qu'un manifeste ne lit pas le CSS —
       si les tokens changent, ces deux lignes sont à changer aussi. */
    background_color: "#fcf8f3",
    theme_color: "#b64c1b",
    /* Chaque taille est déclarée DEUX fois, `any` puis `maskable` : le
       type de Next refuse la valeur combinée « any maskable ». Même
       fichier, plein cadre, qu'Android peut recadrer en cercle ou en
       goutte sans rogner le « M ». */
    icons: [
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
