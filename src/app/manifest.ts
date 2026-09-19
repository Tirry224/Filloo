import type { MetadataRoute } from "next";

/**
 * Le manifeste, première pierre des notifications push.
 *
 * POURQUOI CE FICHIER EXISTE MAINTENANT
 * Sans lui, aucun téléphone ne propose « Ajouter à l'écran d'accueil », et
 * sur iPhone c'est éliminatoire : Safari n'autorise le push QUE pour une
 * application installée depuis l'écran d'accueil. Un manifeste ne sert
 * donc pas qu'à faire joli dans la liste des applications — il est la
 * condition d'entrée.
 *
 * POURQUOI UNE ROUTE TYPÉE ET NON UN `public/manifest.json`
 * Next sert ce fichier à `/manifest.webmanifest` avec le bon type MIME et
 * vérifie les champs à la compilation. Un JSON posé à la main dans
 * `public/` se serait tu le jour d'une faute de frappe.
 *
 * `display: "standalone"` : lancée depuis l'écran d'accueil, Makiti
 * s'ouvre sans la barre d'adresse du navigateur. Ce n'est pas cosmétique —
 * c'est ce qui la fait ressembler à une application qu'on garde, et non à
 * un site qu'on visite.
 *
 * `start_url: "/"` et non l'écran vendeur : une connexion qui n'a qu'un
 * compte commerçant est redirigée par `landingForSession`, et une
 * connexion cliente atterrit là où elle doit. Le manifeste ne connaît pas
 * la personne, il ne doit donc pas choisir à sa place.
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
    /* Chaque taille est déclarée DEUX fois, `any` puis `maskable`, parce
       que le type de Next n'accepte pas la valeur combinée « any maskable »
       du standard. Le fichier est le même : l'icône est plein cadre, donc
       Android peut la recadrer en cercle, en goutte ou en losange sans
       rogner le « M ». Une icône transparente avec des marges se
       retrouverait rognée de travers selon le téléphone. */
    icons: [
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icone-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
