"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";
import type { ActionState } from "@/lib/actions/auth";

/** Un commerçant approuvé ou non peut préparer des produits (ils resteront
 * en brouillon) ; seule la PUBLICATION est bloquée par le trigger
 * `products_check_publishable` tant que la boutique n'est pas approuvée. */
async function requireMerchantId(): Promise<{ merchantId: string } | { error: string }> {
  const supabase = await createClient();
  const merchant = await getMyMerchant(supabase);
  if (!merchant) return { error: "Vous devez d'abord créer une boutique." };
  return { merchantId: merchant.id };
}

function readProductFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    categoryId: Number(formData.get("categoryId") ?? 0),
    priceGnf: Number(formData.get("priceGnf") ?? 0),
    isNegotiable: formData.get("isNegotiable") === "on",
    description: String(formData.get("description") ?? "").trim(),
    imagePaths: formData.getAll("imagePaths").map(String).filter(Boolean),
  };
}

function validateProductFields(fields: ReturnType<typeof readProductFields>): string | null {
  if (fields.title.length < 3 || fields.title.length > 120) {
    return "Le titre doit faire entre 3 et 120 caractères.";
  }
  if (!fields.categoryId) return "Choisissez une catégorie.";
  if (!Number.isFinite(fields.priceGnf) || fields.priceGnf < 0) return "Le prix n'est pas valide.";
  if (fields.description.length > 2000) return "La description est trop longue.";
  return null;
}

/**
 * Nouveau produit — écran 24. `productId` est généré côté navigateur
 * (`ProductForm`) AVANT l'appel : c'est le même identifiant que
 * `PhotoPicker` utilise déjà pour construire le chemin de chaque photo
 * envoyée dans Storage, donc les photos existent en base (`storage.objects`)
 * avant même que la ligne `products` ne soit créée.
 *
 * Insertion en deux temps, jamais en un seul : le trigger
 * `products_check_publishable` (0002) refuse `status = 'active'` tant
 * qu'aucune ligne `product_images` ne référence CE produit — impossible à
 * satisfaire dans le insert qui crée justement ce produit. On insère donc
 * toujours en `draft`, on rattache les photos, puis on publie si demandé.
 */
export async function createProductAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const owner = await requireMerchantId();
  if ("error" in owner) return owner;

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { error: "Formulaire invalide, rechargez la page." };

  const fields = readProductFields(formData);
  const fieldError = validateProductFields(fields);
  if (fieldError) return { error: fieldError };

  const publish = formData.get("intent") === "publish";
  if (publish && fields.imagePaths.length === 0) {
    return { error: "Ajoutez au moins une photo avant de publier." };
  }

  const supabase = await createClient();

  const { error: insertError } = await supabase.from("products").insert({
    id: productId,
    merchant_id: owner.merchantId,
    category_id: fields.categoryId,
    title: fields.title,
    description: fields.description || null,
    price_gnf: fields.priceGnf,
    is_negotiable: fields.isNegotiable,
    status: "draft",
  });
  if (insertError) return { error: insertError.message };

  if (fields.imagePaths.length > 0) {
    const { error: imagesError } = await supabase.from("product_images").insert(
      fields.imagePaths.map((storage_path, position) => ({ product_id: productId, storage_path, position })),
    );
    if (imagesError) return { error: imagesError.message };
  }

  if (publish) {
    const { data: published, error: publishError } = await supabase
      .from("products")
      .update({ status: "active" })
      .eq("id", productId)
      .select("id");
    if (publishError) return { error: publishError.message };
    // C'est EXACTEMENT le cas que `setProductStatus` protège plus bas et
    // que celui-ci laissait passer : publier est refusé par le trigger
    // `products_check_publishable` quand la boutique n'est plus validée,
    // et un `update` refusé répond un succès à zéro ligne. Le produit
    // restait en `draft` pendant que l'écran annonçait la publication.
    if (!published || published.length === 0) {
      return { error: "Publication impossible : votre boutique doit être validée, et le produit avoir au moins une photo. Il est enregistré en brouillon." };
    }
  }

  redirect("/vendeur");
}

/**
 * Modifier un produit — écran 25 (« Modifier le produit »). Ne touche
 * jamais `status` : un produit vendu ou masqué le reste après une
 * correction de prix, ce sont des actions séparées (voir plus bas).
 */
export async function updateProductAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { error: "Formulaire invalide, rechargez la page." };

  const fields = readProductFields(formData);
  const fieldError = validateProductFields(fields);
  if (fieldError) return { error: fieldError };

  const supabase = await createClient();

  /* Un produit PUBLIÉ doit garder au moins une photo. Sans ce garde-fou,
     le remplacement des photos plus bas (`delete` de toutes les lignes
     puis `insert` de la liste finale) sortait le produit du catalogue
     public en le laissant `active` — une vignette vide dans le fil.
     Vérifié en base, puis fermé par un trigger
     (0011_active_product_keeps_an_image.sql).

     Pourquoi refuser ICI alors que la base protège déjà l'invariant : le
     trigger repasse le produit en brouillon, ce qui est le bon état mais
     une mauvaise surprise. Le commerçant a cliqué « Enregistrer », pas
     « Dépublier » — il verrait son annonce disparaître du catalogue sans
     jamais l'avoir demandé. La base garantit l'invariant ; ce message
     explique. Les deux ont leur rôle, aucun ne remplace l'autre. */
  if (fields.imagePaths.length === 0) {
    const { data: current } = await supabase
      .from("products")
      .select("status")
      .eq("id", productId)
      .maybeSingle();
    if (current?.status === "active") {
      return { error: "Gardez au moins une photo : sans photo, votre produit ne peut pas rester publié." };
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("products")
    .update({
      category_id: fields.categoryId,
      title: fields.title,
      description: fields.description || null,
      price_gnf: fields.priceGnf,
      is_negotiable: fields.isNegotiable,
    })
    .eq("id", productId)
    .select("id");
  if (updateError) return { error: updateError.message };
  if (!updated || updated.length === 0) {
    return { error: "Modification impossible : ce produit n'existe plus, ou il n'est pas le vôtre." };
  }

  // Remplace toutes les lignes `product_images` par la liste finale envoyée
  // par `PhotoPicker`, plutôt que de comparer ancien/nouveau photo par
  // photo : `unique (product_id, position)` rendrait ce calcul fragile dès
  // qu'une photo du milieu est retirée (les positions suivantes se
  // décalent). Les fichiers dans Storage, eux, sont déjà supprimés par
  // `PhotoPicker` au moment du clic sur « retirer » — voir ce fichier.
  // Cette suppression ne lisait NI son erreur NI son résultat. Si le RLS
  // l'écarte, les anciennes lignes restent et la ré-insertion qui suit
  // ajoute les nouvelles par-dessus : le produit se retrouve avec les deux
  // jeux de photos, et `unique (product_id, position)` fait alors échouer
  // l'insertion avec un message incompréhensible pour le commerçant.
  const { error: clearError } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", productId);
  if (clearError) return { error: clearError.message };
  if (fields.imagePaths.length > 0) {
    const { error: imagesError } = await supabase.from("product_images").insert(
      fields.imagePaths.map((storage_path, position) => ({ product_id: productId, storage_path, position })),
    );
    if (imagesError) return { error: imagesError.message };
  }

  redirect("/vendeur");
}

/**
 * Retour vers « Mes produits », en portant un message d'erreur dans l'URL
 * quand il y en a un. Les lignes de la feuille d'actions sont de vraies
 * `<form>` de composants serveur (pas de `useActionState`), pour continuer
 * à fonctionner sans JavaScript : l'URL est donc le seul canal qui
 * survive à la redirection. `/vendeur` affiche le message avec `Notice`.
 */
function backToSeller(errorMessage?: string): never {
  redirect(errorMessage ? `/vendeur?erreur=${encodeURIComponent(errorMessage)}` : "/vendeur");
}

/**
 * Changement de statut : vendu, masqué, republié.
 *
 * Deux façons distinctes d'échouer, et une seule était traitée
 * jusqu'ici — aucune des deux, en réalité, puisque le résultat n'était
 * pas lu du tout :
 *
 * 1. **Une erreur remontée** (`error`) : c'est le cas de « Republier »
 *    quand la boutique n'est plus approuvée — le trigger
 *    `products_check_publishable` lève une exception, avec un message
 *    déjà écrit en français.
 * 2. **Aucune erreur, mais aucune ligne touchée** : quand le RLS filtre
 *    la ligne, PostgREST ne renvoie PAS d'erreur, il renvoie un succès
 *    portant zéro ligne. « Pas d'erreur » ne veut donc jamais dire
 *    « c'est fait ». D'où le `.select("id")` : c'est la seule façon de
 *    savoir ce qui a réellement changé.
 *
 * Sans ces deux vérifications, un commerçant cliquait « Republier »,
 * revenait sur « Mes produits », voyait son produit toujours masqué, et
 * concluait que l'application était cassée. Il n'avait pas tort.
 */
async function setProductStatus(formData: FormData, status: "active" | "sold" | "hidden") {
  const productId = String(formData.get("productId") ?? "");
  if (!productId) backToSeller("Formulaire invalide, rechargez la page.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ status })
    .eq("id", productId)
    .select("id");

  if (error) backToSeller(error.message);
  if (!data || data.length === 0) {
    backToSeller("Action impossible : ce produit n'existe plus, ou il n'est pas le vôtre.");
  }
  backToSeller();
}

/** Marquer vendu — le produit reste visible, barré (écran 25). */
export async function markSoldAction(formData: FormData) {
  await setProductStatus(formData, "sold");
}

/** Masquer du catalogue — réversible, contrairement à la suppression. */
export async function hideProductAction(formData: FormData) {
  await setProductStatus(formData, "hidden");
}

/** Republier un produit masqué. Repasse par le même trigger que la
 * publication initiale : refusé si la boutique n'est plus approuvée. */
export async function republishProductAction(formData: FormData) {
  await setProductStatus(formData, "active");
}

/** Suppression définitive — les conversations qui citent ce produit sont
 * conservées : `messages.product_id` référence `products` en
 * `on delete set null` (0001_schema.sql), donc la ligne du produit
 * disparaît mais pas les messages qui le citaient. */
export async function deleteProductAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  if (!productId) backToSeller("Formulaire invalide, rechargez la page.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").delete().eq("id", productId).select("id");

  if (error) backToSeller(error.message);
  // Même raison que `setProductStatus` : une suppression filtrée par le
  // RLS ne lève aucune erreur, elle supprime simplement zéro ligne. Se
  // taire ici, sur une action irréversible, serait le pire endroit du
  // projet pour le faire.
  if (!data || data.length === 0) {
    backToSeller("Suppression impossible : ce produit n'existe plus, ou il n'est pas le vôtre.");
  }
  backToSeller();
}
