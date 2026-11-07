import { NouvelleCampagneVue } from "@/components/admin/NouvelleCampagneVue";
import { getMerchant, getMerchantProducts } from "@/lib/data/merchants";
import { boutiquesEnLigne, lireTarifs } from "@/lib/data/publicite";
import { createClient } from "@/lib/supabase/server";

/** L'équipe crée une publicité pour une boutique (0048). Garde : `admin/layout.tsx`. */
export default async function NouvelleCampagnePage({
  searchParams,
}: {
  searchParams: Promise<{ boutique?: string; erreur?: string }>;
}) {
  const { boutique: boutiqueId, erreur } = await searchParams;
  const supabase = await createClient();
  const [boutiques, tarifs] = await Promise.all([boutiquesEnLigne(supabase), lireTarifs(supabase)]);
  const boutique = boutiques.find((b) => b.id === boutiqueId) ?? null;
  const merchant = boutique ? await getMerchant(supabase, boutique.id) : null;
  const produits = merchant ? (await getMerchantProducts(supabase, merchant)).filter((p) => p.status === "active") : [];
  return <NouvelleCampagneVue boutiques={boutiques} boutique={boutique} produits={produits} tarifs={tarifs} erreur={erreur} />;
}
