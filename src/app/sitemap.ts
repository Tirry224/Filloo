import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { siteUrl } from "@/lib/site-url";

/**
 * Le plan du site : la liste des adresses que Makiti accepte de voir
 * indexées.
 *
 * CE QUI DÉCIDE DE LA LISTE, ce n'est pas ce fichier — c'est le RLS. La
 * requête part d'un client ANONYME (`createPublicClient`), donc la base ne
 * rend que ce qu'un visiteur non connecté peut déjà lire : produits
 * `active` ou `sold` de boutiques `approved`, rien d'autre. Un produit
 * supprimé, masqué, en brouillon, ou appartenant à une boutique refusée ou
 * suspendue disparaît d'ici SANS qu'aucune condition n'ait à être écrite
 * deux fois.
 *
 * C'est la seule façon tenable : une liste de statuts recopiée ici aurait
 * cessé d'être vraie à la première migration qui en ajoute un, et
 * personne ne relit un sitemap.
 *
 * Les produits VENDUS restent listés à dessein : leur page existe toujours
 * et reste lisible (décisions 0008 et 0020). Leur `generateMetadata` porte
 * un `noindex` — être dans le plan du site et refuser l'indexation n'est
 * pas contradictoire : le premier dit « cette adresse existe », le second
 * « ne la propose pas dans les résultats ».
 */

/** Une heure. Le catalogue d'une marketplace naissante ne bouge pas plus
 * vite, et regénérer ce fichier à chaque passage de robot coûterait deux
 * requêtes à la base pour un résultat identique. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  /* Sans adresse configurée, un sitemap ne peut porter que des liens
     relatifs — que les moteurs rejettent. Mieux vaut un plan vide qu'un
     plan faux. */
  if (!base) return [];

  const supabase = createPublicClient();

  const [{ data: produits }, { data: boutiques }] = await Promise.all([
    supabase.from("products").select("id, updated_at").order("updated_at", { ascending: false }).limit(5000),
    /* `created_at` et non `updated_at` : la table `merchants` n'a pas de
       colonne de dernière modification (0001). Une boutique dont le nom
       change gardera donc la date de sa création — c'est faux pour un
       moteur, mais moins faux que de ne rien donner, et la vraie
       correction est une colonne, pas une approximation ici. */
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
