import { notFound, redirect } from "next/navigation";
import { ProductForm } from "@/components/product/ProductForm";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";
import { getCategories } from "@/lib/data/reference";

/**
 * « Modifier le produit », ouvert depuis l'écran 25. RLS ("products: je
 * gere mes produits") ne laisse de toute façon lire que ses propres
 * produits ; `notFound()` couvre aussi bien « n'existe pas » que
 * « appartient à quelqu'un d'autre » — comme pour la fiche produit
 * publique, ce n'est pas à cet écran de distinguer les deux.
 */
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Les quatre lectures sont indépendantes : aucune n'a besoin du résultat
  // d'une autre pour démarrer.
  const [merchant, { data: product, error }, { data: images }, categories] = await Promise.all([
    getMyMerchant(supabase),
    supabase
      .from("products")
      .select("id, title, category_id, price_gnf, is_negotiable, description")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("product_images").select("storage_path, position").eq("product_id", id).order("position"),
    getCategories(supabase),
  ]);
  if (!merchant) redirect("/inscription/boutique");
  if (error) throw error;
  if (!product) notFound();

  return (
    <Screen>
      <TopBar title="Modifier le produit" backHref={`/vendeur/produits/${id}/actions`} />
      <ProductForm
        mode="edit"
        productId={product.id}
        merchantId={merchant.id}
        categories={categories}
        initial={{
          title: product.title,
          categoryId: product.category_id,
          priceGnf: product.price_gnf,
          isNegotiable: product.is_negotiable,
          description: product.description ?? "",
          imagePaths: (images ?? []).map((i) => i.storage_path),
        }}
      />
    </Screen>
  );
}
