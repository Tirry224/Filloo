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
 * `products_check_publishable` (0002, élargi par 0018) refuse toute
 * ENTRÉE au catalogue — `status = 'active'` comme `status = 'sold'` —
 * tant qu'aucune ligne `product_images` ne référence CE produit, ce qui
 * est impossible à satisfaire dans le insert qui crée justement ce
 * produit. On insère donc toujours en `draft`, on rattache les photos,
 * puis on publie si demandé.
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
    // Les DEUX refus possibles ne passent pas par le même canal, et il a
    // fallu les lire dans la vraie base (2026-09-13) pour cesser de les
    // confondre :
    //
    // - « pas de photo » et « boutique non validée » viennent du trigger
    //   `check_product_publishable`, qui lève une EXCEPTION portant son
    //   propre message en français. C'est `publishError` juste au-dessus
    //   qui les rend, et rien n'est silencieux de ce côté ;
    // - le succès muet à zéro ligne vient du RLS. La policy « products:
    //   je gere mes produits » exige `merchant_id = my_merchant_id()` ET
    //   `is_active_profile(...)` — elle ne regarde PAS la validation de
    //   la boutique. La ligne n'est donc écartée en silence que si le
    //   compte commerçant est suspendu ou supprimé, ou si le produit
    //   n'est pas le sien.
    //
    // Le message ci-dessous doit nommer CE cas-là, pas celui du trigger :
    // un message qui accuse la mauvaise cause envoie le commerçant
    // chercher une photo alors que son compte est suspendu.
    if (!published || published.length === 0) {
      return { error: "Publication impossible : votre compte commerçant n'est plus actif. Le produit est enregistré en brouillon." };
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
    return { error: "Modification impossible : ce produit n'est pas le vôtre, ou votre compte commerçant n'est plus actif." };
  }

  // Remplace toutes les lignes `product_images` par la liste finale envoyée
  // par `PhotoPicker`, plutôt que de comparer ancien/nouveau photo par
  // photo : `unique (product_id, position)` rendrait ce calcul fragile dès
  // qu'une photo du milieu est retirée (les positions suivantes se
  // décalent).
  //
  // Cette suppression ne lisait NI son erreur NI son résultat. Si le RLS
  // l'écarte, les anciennes lignes restent et la ré-insertion qui suit
  // ajoute les nouvelles par-dessus : le produit se retrouve avec les deux
  // jeux de photos, et `unique (product_id, position)` fait alors échouer
  // l'insertion avec un message incompréhensible pour le commerçant.
  //
  // Les chemins d'AVANT sont relus juste avant d'être remplacés : ce sont
  // eux qui diront, une fois la base à jour, quels fichiers ne sont plus
  // référencés par personne.
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

  /* Le ménage dans Storage vient APRÈS l'écriture en base, jamais avant.
     `PhotoPicker` supprimait le fichier au clic sur « retirer », donc avant
     tout enregistrement : quitter l'écran sans enregistrer — ou perdre le
     réseau en chemin — laissait `product_images` pointer sur un fichier
     détruit, c'est-à-dire une vignette cassée dans le catalogue public que
     plus rien ne pouvait réparer.
     La base est la source de vérité, le stockage la suit. Un fichier qu'on
     supprime ici n'est référencé par aucune ligne : les lignes finales
     viennent d'être écrites juste au-dessus.

     Best effort assumé : une suppression ratée laisse un fichier orphelin,
     qui ne casse aucun écran — personne ne le référence. C'est l'erreur la
     moins chère des deux, et la seule qui ne se voie pas. */
  const removedPaths = (previousImages ?? [])
    .map((image) => image.storage_path)
    .filter((path) => !fields.imagePaths.includes(path));

  /* Une dernière question avant de détruire quoi que ce soit : ce fichier
     est-il encore cité AILLEURS ? `product_images.storage_path` n'est
     unique nulle part, et `imagePaths` vient du formulaire, donc du
     navigateur — un envoi fabriqué peut faire pointer un produit sur le
     chemin d'un autre. Supprimer sans regarder reviendrait à laisser une
     écriture sur le produit X détruire la photo du produit Y.
     Le RLS du stockage limite déjà les dégâts au dossier du commerçant
     lui-même ; ce n'est pas une raison de le laisser casser SES propres
     annonces. Une requête de plus, et seulement quand une photo est
     réellement retirée. */
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
 *    quand la boutique n'est plus approuvée, et depuis 0018 celui de
 *    « Marquer vendu » sur un produit qui n'était pas déjà publié —
 *    `sold` est un état public, il passe par la même porte. Le trigger
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
