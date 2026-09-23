import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Un client PAR REQUÊTE, jamais un singleton :
 * les cookies de session diffèrent, un client partagé mélangerait les
 * utilisateurs.
 *
 * `setAll` peut échouer dans un composant serveur pur (pas de réponse à
 * écrire) : sans conséquence tant que le middleware rafraîchit la session,
 * d'où l'erreur avalée. `cache()` mémorise le client pour la durée d'UNE
 * requête, sans quoi `getSessionUser` ne dédupliquerait pas ses appels —
 * deux clients, deux clés de cache.
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
