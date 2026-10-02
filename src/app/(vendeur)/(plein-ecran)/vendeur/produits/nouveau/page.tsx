import { redirect } from "next/navigation";
import { ProductForm } from "@/components/product/ProductForm";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";
import { getCategories } from "@/lib/data/reference";

export default async function NewProductPage() {
  const supabase = await createClient();
  const [merchant, categories] = await Promise.all([getMyMerchant(supabase), getCategories(supabase)]);
  if (!merchant) redirect("/inscription/boutique");

  return (
    <Screen>
      <TopBar title="Nouveau produit" backHref="/vendeur/produits" />
      <ProductForm mode="create" merchantId={merchant.id} categories={categories} />
    </Screen>
  );
}
