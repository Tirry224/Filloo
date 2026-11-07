import { redirect } from "next/navigation";
import { AbonnementVue } from "@/components/abonnement/AbonnementVue";
import { lireTarifsAbonnement, maFormule, mesAbonnements } from "@/lib/data/abonnements";
import { getMerchantProducts, getMyMerchant } from "@/lib/data/merchants";
import { lireMoyensPaiement } from "@/lib/data/publicite";
import { createClient } from "@/lib/supabase/server";

/** « Mon abonnement » du commerçant (0059). Garde héritée de `(vendeur)/layout.tsx`. */
export default async function AbonnementPage({ searchParams }: { searchParams: Promise<{ erreur?: string; info?: string }> }) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/vendeur/boutique");
  const [ma, tarifs, abonnements, moyens, produits] = await Promise.all([
    maFormule(supabase),
    lireTarifsAbonnement(supabase),
    mesAbonnements(supabase),
    lireMoyensPaiement(supabase),
    getMerchantProducts(supabase, merchant),
  ]);
  return (
    <AbonnementVue
      ma={ma}
      tarifs={tarifs}
      abonnements={abonnements}
      moyens={moyens}
      produitsPublies={produits.filter((p) => p.status === "active").length}
      erreur={erreur}
      info={info}
    />
  );
}
