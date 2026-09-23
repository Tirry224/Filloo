import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * À NE PAS CONFONDRE avec une protection : `robots.txt` est une demande
 * polie, que seuls les robots honnêtes respectent. Ce qui protège
 * réellement les écrans privés, c'est le RLS et les gardes de route
 * (`npm run gardes`).
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/messages",
        "/compte",
        "/vendeur",

        "/auth/",
        "/reinitialiser-mot-de-passe",
        "/mot-de-passe-oublie",

        "/connexion",
        "/inscription",

        "/api/",

        "/ecrans",
        "/styleguide",
      ],
    },
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
