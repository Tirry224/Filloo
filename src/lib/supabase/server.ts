import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase pour les composants serveur (voir
 * src/components/README.md). Un client PAR REQUÊTE, jamais un singleton
 * module-level : les cookies de session diffèrent d'une requête à
 * l'autre, un client partagé mélangerait les utilisateurs.
 *
 * `setAll` peut échouer dans un composant serveur pur (pas de réponse à
 * écrire) : sans conséquence tant qu'un middleware rafraîchit la session
 * ailleurs, d'où l'erreur avalée plutôt que la page en échec.
 *
 * `cache()` mémorise le client pour la durée d'UNE requête. Sans ce
 * partage, `getSessionUser` (`src/lib/data/session.ts`) ne dédupliquerait
 * pas ses appels : deux clients sont deux clés de cache différentes.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Appelé depuis un composant serveur sans réponse à écrire.
          }
        },
      },
    },
  );
});
