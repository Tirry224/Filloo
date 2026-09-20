import { redirect } from "next/navigation";
import { ProductForm } from "@/components/product/ProductForm";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";
import { getCategories } from "@/lib/data/reference";

/**
 * Écran 24 — ajouter un produit. Une boutique en attente peut déjà
 * préparer des produits (ils resteront en brouillon) ; seule la
 * publication exige une boutique approuvée, et c'est
 * `products_check_publishable` (0002) qui tranche, pas cet écran.
 *
 * Cet écran n'AUTORISE donc rien : il ne fait que ne pas proposer ce que la
 * base refusera. `canPublish` est un affichage, jamais un droit. Le statut
 * n'est lu qu'ICI : le formulaire ne reçoit que la réponse, pas la
 * question.
 *
 * UNE BOUTIQUE REFUSÉE N'EST PAS UNE BOUTIQUE EN ATTENTE. Cet écran était
 * le seul à lire `status` sans en tirer de conséquence : un commerçant
 * REFUSÉ qui arrivait ici recevait le message de l'attente — « publication
 * disponible après validation » — qui lui annonce une validation en cours
 * alors que sa boutique a été refusée. On ne réécrit pas ce message ici,
 * l'écran 21 dit déjà tout (motif, corrections, renvoi) ; le dupliquer en
 * créerait une seconde version qui divergerait.
 */
export default async function NewProductPage() {
  const supabase = await createClient();
  // Indépendantes l'une de l'autre : parties en même temps plutôt qu'en
  // attendant le résultat de la première pour lancer la seconde.
  const [merchant, categories] = await Promise.all([getMyMerchant(supabase), getCategories(supabase)]);
  if (!merchant) redirect("/inscription/boutique");
  if (merchant.status === "rejected") redirect("/vendeur/refusee");

  return (
    <Screen>
      <TopBar title="Nouveau produit" backHref="/vendeur/produits" />
      <ProductForm
        mode="create"
        merchantId={merchant.id}
        categories={categories}
        canPublish={merchant.status === "approved"}
      />
    </Screen>
  );
}
