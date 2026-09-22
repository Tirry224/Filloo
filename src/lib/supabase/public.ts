import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Client ANONYME, sans cookies : il ne porte la session de personne.
 *
 * Les trois autres clients du dossier répondent chacun à une question
 * différente ; celui-ci répond à « que voit un visiteur qui n'est
 * connecté à rien ? ». Il sert au `sitemap.xml`, et il faut bien
 * distinguer son cas de celui de `server.ts` :
 *
 * `server.ts` lit les cookies de la requête en cours. Un sitemap construit
 * avec lui verrait donc le catalogue AUGMENTÉ de ce que la personne qui le
 * demande a le droit de voir — la policy « products: je gere mes produits »
 * rendant ses propres brouillons et ses produits masqués. Aucune fuite
 * (chacun ne voit que les siens), mais un sitemap qui change selon son
 * lecteur n'est plus un sitemap : c'est l'inverse de ce que le fichier
 * promet. Sans cookies, la réponse est la même pour tout le monde, et
 * Next peut la mettre en cache.
 *
 * `admin.ts` ignore le RLS ; utilisé ici, il publierait les brouillons de
 * tout le monde. Ce fichier existe précisément pour ne pas avoir à
 * choisir entre « trop peu » et « bien trop ».
 *
 * `persistSession: false` parce qu'il n'y a aucune session à garder, et
 * `autoRefreshToken: false` pour qu'aucune minuterie ne se lance dans une
 * fonction serverless qui doit se terminer.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
