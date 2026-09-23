import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Filloo — produits et commerçants près de chez vous",
    short_name: "Filloo",
    description:
      "Trouvez des produits et les commerçants qui les vendent, en Guinée. Parcourez le catalogue et contactez le vendeur pour conclure la vente.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    /* Recopiées de `src/styles/tokens.css` (`--color-paper`,
       `--color-accent`) : un manifeste ne lit pas le CSS, donc ces deux
       lignes sont à changer avec les tokens. */
    background_color: "#fcf8f3",
    theme_color: "#b64c1b",
    /* Chaque taille est déclarée deux fois, `any` puis `maskable` : le
       type de Next refuse la valeur combinée « any maskable ». */
    icons: [
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
