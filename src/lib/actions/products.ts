"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";
import { getSessionUser } from "@/lib/data/session";
import { DECONNECTE, messagePourErreur } from "@/lib/erreurs";
import type { ActionState } from "@/lib/actions/auth";
import { compter } from "@/lib/analytics";
import { PHOTOS_MAX } from "@/lib/storage";
import { lirePrixGnf } from "@/lib/prix";
import { estUuid, lireIdEntier, longueur, texteNettoye } from "@/lib/saisie";

/** Un commerçant approuvé ou non peut préparer des produits (ils resteront
 * en brouillon) ; seule la PUBLICATION est bloquée par le trigger
 * `products_check_publishable` tant que la boutique n'est pas approuvée. */
async function requireMerchantId(): Promise<{ merchantId: string } | { error: string }> {
  const supabase = await createClient();
  // Sans session, « créez d'abord une boutique » enverrait sur une fausse
  // piste : c'est la connexion qui manque (session fermée dans un autre
  // onglet, ou expirée pendant la saisie).
  if (!(await getSessionUser(supabase))) return { error: DECONNECTE };
  const merchant = await getMyMerchant(supabase);
  if (!merchant) return { error: "Vous devez d'abord créer une boutique." };
  return { merchantId: merchant.id };
}

type ProductFields = {
  title: string;
  categoryId: number;
  priceGnf: number;
  isNegotiable: boolean;
  description: string;
  imagePaths: string[];
};

/** Lire ET valider en un seul geste : le prix n'existe comme nombre
 * qu'une fois la saisie acceptée par `lirePrixGnf`. */
function readProductFields(formData: FormData): { fields: ProductFields } | { error: string } {
  // Sans les caractères invisibles : six U+200B faisaient un titre de
  // « 6 caractères » qui s'affichait vide dans le catalogue (2026-09-25).
  const title = texteNettoye(formData.get("title"));
  const categoryId = lireIdEntier(formData.get("categoryId"));
  const prix = lirePrixGnf(String(formData.get("priceGnf") ?? ""));
  const description = texteNettoye(formData.get("description"));
  const imagePaths = formData.getAll("imagePaths").map(String).filter(Boolean);

  if (longueur(title) < 3 || longueur(title) > 120) {
    return { error: "Le titre doit faire entre 3 et 120 caractères." };
  }
  if (!categoryId) return { error: "Choisissez une catégorie." };
  if ("erreur" in prix) return { error: prix.erreur };
  if (longueur(description) > 2000) return { error: "La description est trop longue : 2 000 caractères maximum." };
  if (imagePaths.length > PHOTOS_MAX) return { error: `${PHOTOS_MAX} photos au maximum.` };
  /* `PhotoPicker` pose ce champ tant qu'une photo s'envoie encore : le
     bouton restait actif, et publier à ce moment-là répondait « ajoutez
     au moins une photo » à quelqu'un qui venait d'en ajouter une. */
  if (formData.get("photosEnCours")) {
    return { error: "Une photo est encore en cours d'envoi. Attendez qu'elle s'affiche, puis réessayez." };
  }

  return {
    fields: {
      title,
      categoryId,
      priceGnf: prix.prix,
      isNegotiable: formData.get("isNegotiable") === "on",
      description,
      imagePaths,
    },
  };
}

/**
 * Une photo n'est acceptée que rangée là où `PhotoPicker` la dépose :
 * `{merchant_id}/{product_id}/{nom}.webp`, le chemin que le RLS du
 * stockage (0004) impose à l'ENVOI. Rien ne l'imposait à
 * l'enregistrement : un champ caché forgé faisait afficher sur son
 * produit les photos d'une autre boutique, ou un chemin en `../`
 * (2026-09-25).
 */
function photosRangees(chemins: string[], merchantId: string, productId: string): boolean {
  const dossier = `${merchantId}/${productId}/`;
  return chemins.every((c) => c.startsWith(dossier) && /^[\w-]+\.webp$/.test(c.slice(dossier.length)));
}

/**
 * INSERTION EN DEUX TEMPS : le trigger
 * `products_check_publishable` (0002, élargi par 0018) exige une ligne
 * `product_images`, impossible à satisfaire dans l'insert qui crée le
 * produit. Donc `draft`, puis les photos, puis la publication.
 *
 * `productId` vient du navigateur, `PhotoPicker` ayant déjà rangé les
 * photos sous cet identifiant dans Storage.
 */
export async function createProductAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const owner = await requireMerchantId();
  if ("error" in owner) return owner;

  const productId = String(formData.get("productId") ?? "");
  if (!estUuid(productId)) return { error: "Formulaire invalide, rechargez la page." };

  const lu = readProductFields(formData);
  if ("error" in lu) return lu;
  const { fields } = lu;

  if (!photosRangees(fields.imagePaths, owner.merchantId, productId)) {
    return { error: "Formulaire invalide, rechargez la page." };
  }

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

  /* 23505 = ce `productId` existe déjà. Ce n'est pas une faute de saisie :
     c'est le RÉESSAI d'un envoi dont l'insertion avait réussi et la suite
     échoué (photos, publication). `ProductForm` fige l'identifiant dans un
     `useState` — volontairement, puisque `PhotoPicker` a déjà rangé les
     fichiers sous ce nom — donc réessayer retombe forcément dessus. Sans
     ce rattrapage, le commerçant lit « duplicate key value violates unique
     constraint » en anglais et n'a plus aucune issue : ni réessayer, ni
     recharger, la page reprenant le même identifiant.

     On REPREND donc le brouillon au lieu de refuser. Le `update` passe par
     le RLS, qui n'autorise que ses propres produits : un identifiant
     appartenant à un autre commerçant ne ramène zéro ligne et se dit
     autrement. */
  if (insertError) {
    if (insertError.code !== "23505") return { error: messagePourErreur(insertError, "produits") };

    const { data: repris, error: repriseError } = await supabase
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
    if (repriseError) return { error: messagePourErreur(repriseError, "produits") };
    if (!repris || repris.length === 0) {
      return { error: "Ce produit existe déjà et n'est pas le vôtre. Rechargez la page pour en créer un nouveau." };
    }
  }

  if (fields.imagePaths.length > 0) {
    /* Le réessai rejoue les mêmes chemins : sans ce nettoyage, l'insertion
       bute sur `unique (product_id, position)` et l'impasse se déplace
       d'un cran. Remplacer est aussi ce que fait `updateProductAction`. */
    const { error: clearError } = await supabase
      .from("product_images")
      .delete()
      .eq("product_id", productId);
    if (clearError) return { error: messagePourErreur(clearError, "produits") };

    const { error: imagesError } = await supabase.from("product_images").insert(
      fields.imagePaths.map((storage_path, position) => ({ product_id: productId, storage_path, position })),
    );
    if (imagesError) return { error: messagePourErreur(imagesError, "produits") };
  }

  if (publish) {
    const { data: published, error: publishError } = await supabase
      .from("products")
      .update({ status: "active" })
      .eq("id", productId)
      .select("id");
    if (publishError) return { error: messagePourErreur(publishError, "produits") };
    // Deux refus, deux canaux : « pas de photo » et « boutique non
    // validée » remontent par `publishError` ; le succès muet à zéro ligne
    // vient du RLS, qui n'écarte que compte suspendu, supprimé ou produit
    // d'autrui. Le message ci-dessous nomme CE cas.
    if (!published || published.length === 0) {
      return { error: "Publication impossible : votre compte commerçant n'est plus actif. Le produit est enregistré en brouillon." };
    }
  }

  compter("produit_cree", { role: "merchant", merchantId: owner.merchantId, categoryId: fields.categoryId });

  backToSeller(undefined, publish ? "Produit publié. Il est visible dans le catalogue." : "Brouillon enregistré.");
}

/**
 * Ne touche jamais `status` : un produit vendu ou masqué le reste après
 * une correction de prix, ce sont des actions séparées (voir plus bas).
 */
export async function updateProductAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const productId = String(formData.get("productId") ?? "");
  if (!estUuid(productId)) return { error: "Formulaire invalide, rechargez la page." };

  const owner = await requireMerchantId();
  if ("error" in owner) return owner;

  const lu = readProductFields(formData);
  if ("error" in lu) return lu;
  const { fields } = lu;

  if (!photosRangees(fields.imagePaths, owner.merchantId, productId)) {
    return { error: "Formulaire invalide, rechargez la page." };
  }

  const publish = formData.get("intent") === "publish";
  if (publish && fields.imagePaths.length === 0) {
    return { error: "Ajoutez au moins une photo avant de publier." };
  }

  const supabase = await createClient();

  /* Un produit publié doit garder au moins une photo, sinon le
     remplacement plus bas laisse une vignette vide dans le fil. Le trigger
     de 0011 garantit l'invariant en repassant en brouillon ; ce message
     existe parce que le commerçant a cliqué « Enregistrer », pas
     « Dépublier ». */
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
  if (updateError) return { error: messagePourErreur(updateError, "produits") };
  if (!updated || updated.length === 0) {
    return { error: "Modification impossible : ce produit n'est pas le vôtre, ou votre compte commerçant n'est plus actif." };
  }

  // Réécrire position par position, puis retirer les positions en trop :
  // tout supprimer d'abord déclencherait `unpublish_products_without_image`
  // (0011), qui repasse un produit publié en brouillon sans le dire.
  const { data: previousImages } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId);

  if (fields.imagePaths.length > 0) {
    const { error: imagesError } = await supabase.from("product_images").upsert(
      fields.imagePaths.map((storage_path, position) => ({ product_id: productId, storage_path, position })),
      { onConflict: "product_id,position" },
    );
    if (imagesError) return { error: messagePourErreur(imagesError, "produits") };
  }
  const { error: clearError } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", productId)
    .gte("position", fields.imagePaths.length);
  if (clearError) return { error: messagePourErreur(clearError, "produits") };

  /* Le ménage dans Storage vient APRÈS l'écriture en base : supprimer
     d'abord laisserait `product_images` pointer sur un fichier détruit si
     l'écran est quitté. La base est la source de vérité, le stockage la
     suit. Best effort assumé : une suppression ratée laisse un orphelin,
     la moins chère des deux erreurs. */
  const removedPaths = (previousImages ?? [])
    .map((image) => image.storage_path)
    .filter((path) => !fields.imagePaths.includes(path));

  /* Ce fichier est-il encore cité ailleurs ? `storage_path` n'est unique
     nulle part et `imagePaths` vient du navigateur : sans ce contrôle, un
     envoi fabriqué fait détruire la photo de Y en écrivant sur X. Une
     requête de plus, seulement quand une photo est retirée. */
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

  if (publish) {
    const { data: published, error: publishError } = await supabase
      .from("products")
      .update({ status: "active" })
      .eq("id", productId)
      .eq("status", "draft")
      .select("id");
    if (publishError) return { error: messagePourErreur(publishError, "produits") };
    if (!published || published.length === 0) {
      return { error: "Publication impossible : ce produit n'est plus un brouillon, ou votre compte commerçant n'est plus actif. Vos modifications sont enregistrées." };
    }
  }

  backToSeller(undefined, publish ? "Produit publié. Il est visible dans le catalogue." : "Modifications enregistrées.");
}

/** Retour vers « Mes produits », le message d'erreur porté par l'URL : les
 * lignes de la feuille d'actions sont de vraies `<form>` serveur, et l'URL
 * est le seul canal qui survive à la redirection. */
function backToSeller(errorMessage?: string, successMessage?: string): never {
  if (errorMessage) redirect(`/vendeur/produits?erreur=${encodeURIComponent(errorMessage)}`);
  redirect(successMessage ? `/vendeur/produits?info=${encodeURIComponent(successMessage)}` : "/vendeur/produits");
}

const STATUS_DONE = {
  active: "Produit publié. Il est visible dans le catalogue.",
  sold: "Produit marqué comme vendu.",
  hidden: "Produit masqué du catalogue.",
} as const;

/**
 * Changement de statut : vendu, masqué, republié. « Pas d'erreur » ne veut
 * pas dire « fait » — deux façons d'échouer :
 *
 * 1. une exception du trigger `products_check_publishable` ;
 * 2. un succès à ZÉRO ligne, quand le RLS l'écarte — d'où `.select("id")`.
 */
async function setProductStatus(formData: FormData, status: "active" | "sold" | "hidden") {
  const productId = String(formData.get("productId") ?? "");
  if (!estUuid(productId)) backToSeller("Formulaire invalide, rechargez la page.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ status })
    .eq("id", productId)
    .select("id");

  if (error) backToSeller(messagePourErreur(error, "produits"));
  if (!data || data.length === 0) {
    backToSeller("Action impossible : ce produit n'existe plus, ou il n'est pas le vôtre.");
  }
  backToSeller(undefined, STATUS_DONE[status]);
}

export async function markSoldAction(formData: FormData) {
  await setProductStatus(formData, "sold");
}

export async function hideProductAction(formData: FormData) {
  await setProductStatus(formData, "hidden");
}

/** Repasse par le même trigger que la publication initiale : refusé si la
 * boutique n'est plus approuvée. */
export async function republishProductAction(formData: FormData) {
  await setProductStatus(formData, "active");
}

/** Suppression définitive — les conversations qui citent ce produit sont
 * conservées : `messages.product_id` référence `products` en
 * `on delete set null` (0001_schema.sql), donc la ligne du produit
 * disparaît mais pas les messages qui le citaient. */
export async function deleteProductAction(formData: FormData) {
  const productId = String(formData.get("productId") ?? "");
  if (!estUuid(productId)) backToSeller("Formulaire invalide, rechargez la page.");

  const supabase = await createClient();

  /* Les chemins se lisent AVANT la suppression : la cascade de 0001 efface
     `product_images`, qui est le seul endroit où ils sont écrits. Après le
     `delete`, plus rien ne permet de retrouver les fichiers — ils
     resteraient dans le stockage pour toujours, facturés et invisibles.
     `updateProductAction` fait ce ménage ; la suppression l'oubliait. */
  const { data: imagesAvant } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId);

  const { data, error } = await supabase.from("products").delete().eq("id", productId).select("id");

  if (error) backToSeller(messagePourErreur(error, "produits"));
  // Comme `setProductStatus` : écartée par le RLS, la suppression ne lève
  // rien et supprime zéro ligne. On ne se tait pas sur un geste
  // irréversible.
  if (!data || data.length === 0) {
    backToSeller("Suppression impossible : ce produit n'existe plus, ou il n'est pas le vôtre.");
  }

  /* Même précaution que dans `updateProductAction` : `storage_path` n'est
     unique nulle part, donc un fichier encore cité par un AUTRE produit ne
     se détruit pas. Best effort assumé, et après la base : un orphelin
     coûte moins cher qu'une vignette vide. */
  const cheminsRetires = (imagesAvant ?? []).map((image) => image.storage_path);
  if (cheminsRetires.length > 0) {
    const { data: encoreCites } = await supabase
      .from("product_images")
      .select("storage_path")
      .in("storage_path", cheminsRetires);
    const cites = new Set((encoreCites ?? []).map((image) => image.storage_path));
    const orphelins = cheminsRetires.filter((chemin) => !cites.has(chemin));

    if (orphelins.length > 0) {
      const { error: storageError } = await supabase.storage.from("product-images").remove(orphelins);
      if (storageError) console.error("photos du produit supprimé restées dans le stockage :", storageError.message);
    }
  }

  backToSeller(undefined, "Produit supprimé.");
}
