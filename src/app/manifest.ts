import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Filloo — la mode en Guinée",
    short_name: "Filloo",
    description:
      "Vêtements, chaussures et accessoires vendus par les boutiques de Guinée. Filtrez par taille, couleur et prix, puis contactez le vendeur.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    /* Recopiées de `src/styles/tokens.css` (`--color-paper`,
       `--color-accent`) : un manifeste ne lit pas le CSS, donc ces deux
       lignes sont à changer avec les tokens. */
    background_color: "#f1f5fa",
    theme_color: "#182b49",
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
