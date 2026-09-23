import type { NextConfig } from "next";

/**
 * L'hôte des photos est DÉDUIT de NEXT_PUBLIC_SUPABASE_URL plutôt que
 * recopié ici : écrit deux fois, il finirait par diverger le jour où le
 * projet Supabase change, et la panne serait silencieuse — Next refuserait
 * simplement d'afficher les images.
 *
 * En revanche cette déduction ne doit JAMAIS faire échouer le build à elle
 * seule. Une première version laissait `new URL()` remonter son erreur :
 * une variable mal saisie (l'adresse sans `https://`, par exemple) faisait
 * planter le build sur un « Invalid URL » qui ne nomme ni la variable, ni
 * le fichier, ni la correction à faire. Le diagnostic appartient à
 * `src/lib/supabase/`, qui connaît le nom des variables et sait quoi
 * conseiller ; ici on se contente d'échouer en silence et de le laisser
 * parler.
 */
function supabaseImageHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;

  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const imageHost = supabaseImageHost();

const nextConfig: NextConfig = {
  /* Next 16 génère AGENTS.md/CLAUDE.md au démarrage s'il n'en trouve pas :
     docs/MEMOIRE.md tient déjà ce rôle, pas besoin d'un second fichier. */
  agentRules: false,

  images: {
    /* Next refuse de servir une image distante dont l'hôte n'est pas
       déclaré ici : c'est volontaire de sa part, sinon n'importe quelle
       URL d'image trouvée dans les données ferait de notre serveur un
       optimiseur d'images gratuit pour le reste d'Internet. */
    remotePatterns: imageHost
      ? [
          {
            protocol: "https" as const,
            hostname: imageHost,
            pathname: "/storage/v1/object/public/product-images/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
