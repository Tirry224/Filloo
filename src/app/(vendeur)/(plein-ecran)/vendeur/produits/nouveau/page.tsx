import { redirect } from "next/navigation";
import { ProductForm } from "@/components/product/ProductForm";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";
import { getCategories } from "@/lib/data/reference";

/**
 * Écran 24 — ajouter un produit. Une boutique en attente peut préparer des
 * produits (ils resteront en brouillon) ; seule la publication exige une
 * boutique approuvée, et c'est `products_check_publishable` (0002) qui
 * tranche, pas cet écran.
 *
 * Il n'AUTORISE donc rien, il évite de proposer ce que la base refusera :
 * `canPublish` est un affichage, jamais un droit, et le statut n'est lu
 * qu'ici — le formulaire ne reçoit que la réponse.
 *
 * Une boutique REFUSÉE est redirigée plutôt que de lire « publication
 * disponible après validation », qui lui annoncerait une validation en
 * cours : l'écran 21 dit déjà tout (motif, corrections, renvoi).
 */
export default async function NewProductPage() {
  const supabase = await createClient();
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
