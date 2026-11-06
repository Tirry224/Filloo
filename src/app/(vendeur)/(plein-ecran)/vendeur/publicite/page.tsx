import { redirect } from "next/navigation";
import { PubliciteVendeurVue } from "@/components/publicite/PubliciteVendeurVue";
import { getMerchantProducts, getMyMerchant } from "@/lib/data/merchants";
import { mesCampagnes } from "@/lib/data/publicite";
import { createClient } from "@/lib/supabase/server";

/** « Publicité et visibilité » du commerçant (0047). Garde héritée de `(vendeur)/layout.tsx`. */
export default async function PublicitePage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/vendeur/boutique");
  const [produits, campagnes] = await Promise.all([getMerchantProducts(supabase, merchant), mesCampagnes(supabase)]);
  return (
    <PubliciteVendeurVue
      produits={produits.filter((p) => p.status === "active")}
      campagnes={campagnes}
      erreur={erreur}
      info={info}
    />
  );
}
