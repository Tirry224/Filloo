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
 * Nouveau produit — écran 24.
 *
 * INSERTION EN DEUX TEMPS, jamais en un seul : le trigger
 * `products_check_publishable` (0002, élargi par 0018) refuse l'entrée au
 * catalogue tant qu'aucune ligne `product_images` ne référence le produit —
 * impossible à satisfaire dans l'insert qui crée ce produit. Donc `draft`,
 * puis les photos, puis la publication.
 *
 * `productId` vient du navigateur : c'est déjà celui sous lequel
 * `PhotoPicker` a rangé les photos dans Storage.
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
    // DEUX REFUS, DEUX CANAUX : « pas de photo » et « boutique non
    // validée » viennent du trigger, en français, via `publishError` ; le
    // succès muet à zéro ligne vient du RLS, qui ne regarde PAS la
    // validation et n'écarte que compte suspendu, supprimé ou produit
    // d'autrui. Le message ci-dessous nomme CE cas : accuser la mauvaise
    // cause envoie chercher une photo à quelqu'un qui est suspendu.
    if (!published || published.length === 0) {
      return { error: "Publication impossible : votre compte commerçant n'est plus actif. Le produit est enregistré en brouillon." };
    }
  }

  redirect("/vendeur/produits");
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

  /* Un produit PUBLIÉ doit garder au moins une photo : le remplacement plus
     bas (tout supprimer puis réinsérer) le sortirait sinon du catalogue en
     le laissant `active`, soit une vignette vide dans le fil. Le trigger de
     0011 garantit déjà l'invariant en repassant le produit en brouillon —
     mais le commerçant a cliqué « Enregistrer », pas « Dépublier ». La base
     garantit, ce message explique. */
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
    return { error: "Modification impossible : ce produit n'est pas le vôtre, ou votre compte commerçant n'est plus actif." };
  }

  // On remplace TOUTES les lignes plutôt que de comparer photo par photo :
  // `unique (product_id, position)` rend ce calcul fragile dès qu'une photo
  // du milieu part, les suivantes se décalant. L'erreur du `delete` se lit :
  // écartée par le RLS, les anciennes lignes resteraient et la réinsertion
  // échouerait sur la contrainte d'unicité, avec un message incompréhensible
  // pour le commerçant.
  //
  // Les chemins d'AVANT sont relus ici : ce sont eux qui diront, une fois la
  // base à jour, quels fichiers ne sont plus référencés par personne.
  const { data: previousImages } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId);

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

  /* Le ménage dans Storage vient APRÈS l'écriture en base, jamais avant :
     `PhotoPicker` supprimait le fichier dès le clic sur « retirer », si
     bien que quitter l'écran ou perdre le réseau laissait
     `product_images` pointer sur un fichier détruit — vignette cassée
     dans le catalogue public, irréparable. La base est la source de
     vérité, le stockage la suit.

     Best effort assumé : une suppression ratée laisse un orphelin que
     personne ne référence, la moins chère des deux erreurs. */
  const removedPaths = (previousImages ?? [])
    .map((image) => image.storage_path)
    .filter((path) => !fields.imagePaths.includes(path));

  /* Ce fichier est-il encore cité AILLEURS ? `storage_path` n'est unique
     nulle part et `imagePaths` vient du navigateur : un envoi fabriqué
     peut faire pointer un produit sur le chemin d'un autre, et supprimer
     sans regarder laisserait une écriture sur X détruire la photo de Y.
     Le RLS du stockage borne les dégâts au dossier du commerçant, ce
     n'est pas une raison de le laisser casser SES annonces. Une requête
     de plus, seulement quand une photo est retirée. */
  if (removedPaths.length > 0) {
    const { data: stillReferenced } = await supabase
      .from("product_images")
      .select("storage_path")
      .in("storage_path", removedPaths);
    const referenced = new Set((stillReferenced ?? []).map((image) => image.storage_path));
    const orphanPaths = removedPaths.filter((path) => !referenced.has(path));

    if (orphanPaths.length > 0) {
      const { error: storageError } = await supabase.storage.from("product-images").remove(orphanPaths);
      if (storageError) console.error("photos retirées non supprimées du stockage :", storageError.message);
    }
  }

  redirect("/vendeur/produits");
}

/**
 * Retour vers « Mes produits », le message d'erreur porté par l'URL. Les
 * lignes de la feuille d'actions sont de vraies `<form>` de composants
 * serveur, sans `useActionState` : elles marchent sans JavaScript, et l'URL
 * est alors le seul canal qui survive à la redirection.
 */
function backToSeller(errorMessage?: string): never {
  redirect(errorMessage ? `/vendeur/produits?erreur=${encodeURIComponent(errorMessage)}` : "/vendeur/produits");
}

/**
 * Changement de statut : vendu, masqué, republié.
 *
 * DEUX FAÇONS D'ÉCHOUER, et « pas d'erreur » ne veut pas dire « fait » :
 *
 * 1. une exception du trigger `products_check_publishable` — « Republier »
 *    boutique non approuvée, ou « Marquer vendu » sur un produit non
 *    publié, `sold` étant un état public depuis 0018 ;
 * 2. un succès à ZÉRO ligne, quand le RLS l'écarte — d'où `.select("id")`.
 *
 * Sans ces contrôles, « Republier » laissait le produit masqué en silence.
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
  // Comme `setProductStatus` : une suppression écartée par le RLS ne lève
  // rien, elle supprime zéro ligne. Se taire sur une action irréversible
  // serait le pire endroit du projet pour le faire.
  if (!data || data.length === 0) {
    backToSeller("Suppression impossible : ce produit n'existe plus, ou il n'est pas le vôtre.");
  }
  backToSeller();
}
