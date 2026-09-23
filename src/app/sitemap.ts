import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { siteUrl } from "@/lib/site-url";

/**
 * CE QUI DÉCIDE DE LA LISTE, ce n'est pas ce fichier — c'est le RLS. La
 * requête part d'un client ANONYME (`createPublicClient`), donc la base ne
 * rend que ce qu'un visiteur non connecté peut déjà lire : produits
 * `active` ou `sold` de boutiques `approved`, rien d'autre.
 */

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  if (!base) return [];

  const supabase = createPublicClient();

  const [{ data: produits }, { data: boutiques }] = await Promise.all([
    supabase.from("products").select("id, updated_at").order("updated_at", { ascending: false }).limit(5000),
    /* `created_at` et non `updated_at` : la table `merchants` n'a pas de
       colonne de dernière modification (0001). */
    supabase.from("merchants").select("id, created_at").order("created_at", { ascending: false }).limit(5000),
  ]);

  const fixes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/recherche`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/conditions`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/confidentialite`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [
    ...fixes,
    ...(boutiques ?? []).map((m) => ({
      url: `${base}/boutique/${m.id}`,
      lastModified: m.created_at ? new Date(m.created_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...(produits ?? []).map((p) => ({
      url: `${base}/produit/${p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
