import { redirect } from "next/navigation";
import { ProductForm } from "@/components/product/ProductForm";
import { Screen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";
import { getCategories } from "@/lib/data/reference";

/**
 * Écran 24 — ajouter un produit. Une boutique en attente peut déjà
 * préparer des produits (ils resteront en brouillon, voir
 * `/vendeur/attente`) ; seule la publication exige une boutique approuvée
 * — c'est `products_check_publishable` (0002) qui tranche, pas cet écran.
 *
 * Cet écran n'AUTORISE donc rien : il se contente de ne pas proposer ce
 * que la base refusera. La nuance compte, parce qu'elle dit où se situe
 * la protection — en base, pas ici — et donc ce qu'on peut changer sans
 * ouvrir un trou. `canPublish` est un affichage, jamais un droit.
 *
 * Le statut n'est lu qu'ICI, à partir de `getMyMerchant` : le
 * formulaire ne reçoit que la réponse, pas la question. Un jour où une
 * quatrième valeur de `merchant_status` apparaîtra, il n'y aura qu'une
 * ligne à relire — celle-ci.
 *
 * UNE BOUTIQUE REFUSÉE N'EST PAS UNE BOUTIQUE EN ATTENTE
 * `/vendeur`, `/vendeur/attente` et `/vendeur/refusee` s'aiguillent déjà
 * mutuellement selon `status` ; cet écran était le seul à lire `status`
 * sans en tirer de conséquence. Un commerçant REFUSÉ qui arrivait ici
 * (adresse tapée, favori, lien d'un ancien écran) recevait donc le
 * message destiné à l'attente — « publication disponible après
 * validation » — qui lui annonce une validation en cours alors que sa
 * boutique a été REFUSÉE, sans dire pourquoi ni comment repartir.
 *
 * On ne réécrit pas ce message ici : l'écran 21 dit déjà tout (le motif
 * de `rejection_reason`, ce qu'il faut corriger, et les deux boutons
 * « Corriger ma boutique » / « Renvoyer à la vérification »). Le
 * dupliquer en écrirait une seconde version, qui divergerait. On envoie
 * donc à l'écran qui sait, comme le fait `/vendeur` juste à côté.
 *
 * Effet de bord voulu : `canPublish === false` ne peut plus signifier
 * qu'UNE chose, « en attente de validation », et le message du
 * formulaire redevient exact au lieu d'être vrai à moitié.
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
      <TopBar title="Nouveau produit" backHref="/vendeur" />
      <ProductForm
        mode="create"
        merchantId={merchant.id}
        categories={categories}
        canPublish={merchant.status === "approved"}
      />
    </Screen>
  );
}
