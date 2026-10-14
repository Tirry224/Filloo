import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { getCategories, getCities } from "@/lib/data/reference";
import { searchProducts } from "@/lib/data/products";

/**
 * Les lectures du catalogue que TOUT LE MONDE voit pareil, gardées en
 * cache côté serveur au lieu d'interroger la base à chaque visite : à
 * mille visiteurs sur l'accueil, la base répond une fois par minute au
 * lieu de mille.
 *
 * Toujours par le client ANONYME : un cache partagé ne doit jamais porter
 * ce qu'une session particulière voit. `search_products` est
 * `security invoker` mais ne rend que les produits publics de boutiques
 * en ligne (0030) — le même résultat pour un visiteur et pour un compte.
 *
 * Le prix : un produit publié, vendu ou retiré apparaît avec au plus une
 * minute de retard dans les listes. L'app écrit directement dans la base,
 * sans passer par le site : un effacement ciblé du cache ne la verrait
 * pas, d'où une durée courte plutôt qu'une invalidation.
 *
 * `unstable_cache` est remplacé par `use cache` en Next 16, qui exige
 * d'activer Cache Components pour tout le site : changement trop large
 * pour ce seul besoin, à reprendre le jour où on l'active.
 */
export const villesEnCache = unstable_cache(() => getCities(createPublicClient()), ["villes"], {
  revalidate: 3600,
});

export const categoriesEnCache = unstable_cache(() => getCategories(createPublicClient()), ["categories"], {
  revalidate: 3600,
});

export const rechercheEnCache = unstable_cache(
  (opts: Parameters<typeof searchProducts>[1]) => searchProducts(createPublicClient(), opts),
  ["recherche"],
  { revalidate: 60 },
);
