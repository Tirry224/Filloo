import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { getCategories } from "@/lib/data/reference";
import { getProduct, searchProducts } from "@/lib/data/products";
import { getMerchant, getMerchantProducts } from "@/lib/data/merchants";
import type { Merchant } from "@/lib/types";

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
export const categoriesEnCache = unstable_cache(() => getCategories(createPublicClient()), ["categories"], {
  revalidate: 3600,
});

export const rechercheEnCache = unstable_cache(
  (opts: Parameters<typeof searchProducts>[1]) => searchProducts(createPublicClient(), opts),
  ["recherche"],
  { revalidate: 60 },
);

/**
 * Fiche produit, boutique et catalogue d'une boutique : mêmes règles, une
 * minute. Ce que SEUL le propriétaire voit (un brouillon, ses produits
 * masqués) n'est pas dans ce cache anonyme : la page retombe alors sur la
 * session, voir `produitVisible` et la page boutique.
 */
export const produitEnCache = unstable_cache((id: string) => getProduct(createPublicClient(), id), ["produit"], {
  revalidate: 60,
});

export const boutiqueEnCache = unstable_cache((id: string) => getMerchant(createPublicClient(), id), ["boutique"], {
  revalidate: 60,
});

export const produitsBoutiqueEnCache = unstable_cache(
  (boutique: Merchant) => getMerchantProducts(createPublicClient(), boutique),
  ["produits-boutique"],
  { revalidate: 60 },
);
