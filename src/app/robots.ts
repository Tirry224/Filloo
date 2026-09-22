import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * Ce qu'un robot d'indexation a le droit de parcourir.
 *
 * À NE PAS CONFONDRE avec une protection : `robots.txt` est une demande
 * polie, que seuls les robots honnêtes respectent. Ce qui protège
 * réellement les écrans privés, c'est le RLS et les gardes de route
 * (`npm run gardes`) — un robot qui ignore ce fichier tombera de toute
 * façon sur une redirection vers `/connexion`. Ce fichier sert à autre
 * chose : éviter que des adresses privées ou sans intérêt n'apparaissent
 * dans les résultats de recherche, et épargner à la base des requêtes
 * inutiles.
 *
 * LA RÈGLE DE LA LISTE : une adresse y figure si elle est personnelle
 * (elle n'a de sens que pour une personne connectée), transitoire (elle
 * porte un jeton), ou technique. Tout le reste — le catalogue, les
 * boutiques, les conditions — est public et doit être trouvable : c'est
 * le but même de Makiti.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        /* Personnel : le contenu de ces écrans appartient à une
           connexion. Indexé, il ne montrerait de toute façon que la page
           de connexion — mais une messagerie qui apparaît dans Google,
           même vide, détruit la confiance qu'on met à écrire dedans. */
        "/messages",
        "/compte",
        "/vendeur",

        /* Transitoire : ces adresses portent ou attendent un jeton à usage
           unique. Une adresse de confirmation indexée est un lien mort
           publié pour toujours. */
        "/auth/",
        "/reinitialiser-mot-de-passe",
        "/mot-de-passe-oublie",

        /* Sans intérêt pour un moteur, et coûteux pour nous : ces écrans
           n'existent que comme étape d'un geste en cours. */
        "/connexion",
        "/inscription",

        /* Technique : rien à indexer, et `/api/notifications` est déclenchée
           par le cron de Vercel, pas par un visiteur. */
        "/api/",

        /* Pages de TRAVAIL. Elles répondent déjà « cette page n'existe
           pas » en production (`notFound()` sous `NODE_ENV`), donc cette
           ligne est une ceinture par-dessus une bretelle — c'est voulu :
           le jour où quelqu'un retire la garde sans y penser, la page ne
           se retrouve pas indexée le lendemain. */
        "/ecrans",
        "/styleguide",
      ],
    },
    /* Sans adresse configurée, pas de ligne `Sitemap:` : une adresse
       relative y est invalide, et une ligne fausse vaut moins que pas de
       ligne du tout. */
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
