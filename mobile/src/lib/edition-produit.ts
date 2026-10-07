import { randomUUID } from "expo-crypto";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";
import { supprimerPhotosOrphelines } from "./vendeur";

/**
 * Créer et modifier un produit : mêmes règles que `createProductAction` et
 * `updateProductAction` du site. Tout passe par le RLS, et les déclencheurs
 * de la base ont le dernier mot (publication sans photo, boutique
 * suspendue) : ce fichier ne fait que présenter leurs refus lisiblement.
 */

export const PHOTOS_MAX = 5;
export const TITRE_MIN = 3;
export const TITRE_MAX = 120;
export const DESCRIPTION_MAX = 2000;
const PRIX_MAX_GNF = 10_000_000_000;
const CHIFFRES_PRIX = 11;
const EXEMPLE = "exemple : 450 000";

/** Ce que le champ prix affiche pendant la saisie : « 1 500 000 ». Confort seulement. */
export function formaterSaisiePrix(valeur: string): string {
  const chiffres = valeur.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, CHIFFRES_PRIX);
  return chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const MILLIERS_GROUPES = /^\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*$/;

/**
 * Le prix en francs ENTIERS (recopié de `lirePrixGnf` du site). `Number()`
 * lirait « 450.000 » comme 450 : le point est ici un séparateur de milliers.
 */
export function lirePrixGnf(saisie: string): { prix: number } | { erreur: string } {
  const texte = saisie.replace(/\s+/g, "").replace(/(gnf|fg)$/i, "");
  if (!texte) return { erreur: "Indiquez le prix." };
  let chiffres: string;
  if (/^\d+$/.test(texte)) chiffres = texte;
  else if (MILLIERS_GROUPES.test(texte)) chiffres = texte.replace(/[.,]/g, "");
  else if (/^[\d.,]+$/.test(texte)) return { erreur: `Le prix s'écrit en francs entiers, sans virgule (${EXEMPLE}).` };
  else return { erreur: `Le prix ne doit contenir que des chiffres (${EXEMPLE}).` };
  const prix = Number(chiffres);
  if (!Number.isSafeInteger(prix) || prix > PRIX_MAX_GNF) {
    return { erreur: "Ce prix est trop grand : 10 000 000 000 GNF au maximum." };
  }
  return { prix };
}

const INVISIBLES = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const nettoyer = (t: string) => t.replace(INVISIBLES, "").trim();
const longueur = (t: string) => [...t].length;

export const nouvelIdentifiant = () => randomUUID();

/**
 * Réduit puis envoie une photo dans `product-images`, rangée là où le RLS
 * du stockage (0004) l'exige : `{boutique}/{produit}/{nom}.jpg`. 1 280 px
 * au plus grand côté, comme sur le site : une photo de téléphone brute
 * pèse plusieurs Mo, payés en données mobiles par le commerçant puis par
 * chaque client.
 */
export async function envoyerPhoto(opts: {
  uri: string;
  largeur: number;
  hauteur: number;
  boutiqueId: string;
  produitId: string;
}): Promise<string> {
  const COTE_MAX = 1280;
  let contexte = ImageManipulator.manipulate(opts.uri);
  if (Math.max(opts.largeur, opts.hauteur) > COTE_MAX) {
    contexte = contexte.resize(opts.largeur >= opts.hauteur ? { width: COTE_MAX } : { height: COTE_MAX });
  }
  const image = await (await contexte.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!image.base64) throw new Error("photo illisible");
  const octets = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
  const chemin = `${opts.boutiqueId}/${opts.produitId}/${randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("product-images").upload(chemin, octets, { contentType: "image/jpeg" });
  if (error) throw error;
  return chemin;
}

export type Saisie = {
  titre: string;
  categorieId: number | null;
  prix: string;
  negociable: boolean;
  description: string;
  photos: string[];
};

type Champs = { titre: string; categorieId: number; prix: number; negociable: boolean; description: string; photos: string[] };

function controler(s: Saisie): { champs: Champs } | { erreur: string } {
  const titre = nettoyer(s.titre);
  const description = nettoyer(s.description);
  if (longueur(titre) < TITRE_MIN || longueur(titre) > TITRE_MAX) {
    return { erreur: `Le titre doit faire entre ${TITRE_MIN} et ${TITRE_MAX} caractères.` };
  }
  if (!s.categorieId) return { erreur: "Choisissez une catégorie." };
  const prix = lirePrixGnf(s.prix);
  if ("erreur" in prix) return { erreur: prix.erreur };
  if (longueur(description) > DESCRIPTION_MAX) return { erreur: "La description est trop longue : 2 000 caractères maximum." };
  if (s.photos.length > PHOTOS_MAX) return { erreur: `${PHOTOS_MAX} photos au maximum.` };
  return { champs: { titre, categorieId: s.categorieId, prix: prix.prix, negociable: s.negociable, description, photos: s.photos } };
}

/** Le refus d'un déclencheur (`P0001`) est rédigé en français dans la migration : on le montre tel quel. */
function lisible(erreur: { code?: string; message: string }): string {
  if (erreur.code === "P0001") return erreur.message;
  if (erreur.message.includes("Network request failed")) return "Pas de connexion internet. Rien n'a été enregistré.";
  console.error("[produits]", erreur.code, erreur.message);
  return "Une erreur est survenue. Réessayez dans un instant.";
}

/**
 * Création EN DEUX TEMPS : `products_check_publishable` exige une photo,
 * impossible à fournir dans l'insert qui crée le produit. Donc brouillon,
 * puis photos, puis publication. Un réessai après un échec à mi-chemin
 * retombe sur le même identifiant (23505) : on REPREND le brouillon.
 */
export async function creerProduit(opts: {
  produitId: string;
  boutiqueId: string;
  saisie: Saisie;
  publier: boolean;
}): Promise<string | null> {
  const lu = controler(opts.saisie);
  if ("erreur" in lu) return lu.erreur;
  const c = lu.champs;
  if (opts.publier && c.photos.length === 0) return "Ajoutez au moins une photo avant de publier.";

  const valeurs = {
    category_id: c.categorieId,
    title: c.titre,
    description: c.description || null,
    price_gnf: c.prix,
    is_negotiable: c.negociable,
  };
  const { error: erreurInsertion } = await supabase
    .from("products")
    .insert({ id: opts.produitId, merchant_id: opts.boutiqueId, status: "draft", ...valeurs });
  if (erreurInsertion) {
    if (erreurInsertion.code !== "23505") return lisible(erreurInsertion);
    const { data: repris, error } = await supabase.from("products").update(valeurs).eq("id", opts.produitId).select("id");
    if (error) return lisible(error);
    if (!repris || repris.length === 0) return "Ce produit existe déjà et n'est pas le vôtre. Recommencez la création.";
  }

  if (c.photos.length > 0) {
    // Le réessai rejoue les mêmes chemins : on remplace plutôt que buter sur `unique (product_id, position)`.
    const { error: erreurVidage } = await supabase.from("product_images").delete().eq("product_id", opts.produitId);
    if (erreurVidage) return lisible(erreurVidage);
    const { error } = await supabase
      .from("product_images")
      .insert(c.photos.map((storage_path, position) => ({ product_id: opts.produitId, storage_path, position })));
    if (error) return lisible(error);
  }

  if (opts.publier) {
    const { data, error } = await supabase.from("products").update({ status: "active" }).eq("id", opts.produitId).select("id");
    if (error) return lisible(error);
    if (!data || data.length === 0) {
      return "Publication impossible : votre compte commerçant n'est plus actif. Le produit est enregistré en brouillon.";
    }
  }
  return null;
}

/**
 * Ne touche jamais au statut, sauf `publier` sur un brouillon. Les photos
 * se réécrivent position par position avant de retirer celles en trop :
 * tout supprimer d'abord ferait repasser un produit publié en brouillon
 * (`unpublish_products_without_image`, 0011), sans le dire.
 */
export async function modifierProduit(opts: { produitId: string; saisie: Saisie; publier: boolean }): Promise<string | null> {
  const lu = controler(opts.saisie);
  if ("erreur" in lu) return lu.erreur;
  const c = lu.champs;
  if (opts.publier && c.photos.length === 0) return "Ajoutez au moins une photo avant de publier.";

  if (c.photos.length === 0) {
    const { data: actuel } = await supabase.from("products").select("status").eq("id", opts.produitId).maybeSingle();
    if (actuel?.status === "active") return "Gardez au moins une photo : sans photo, votre produit ne peut pas rester publié.";
  }

  const { data: modifie, error } = await supabase
    .from("products")
    .update({
      category_id: c.categorieId,
      title: c.titre,
      description: c.description || null,
      price_gnf: c.prix,
      is_negotiable: c.negociable,
    })
    .eq("id", opts.produitId)
    .select("id");
  if (error) return lisible(error);
  if (!modifie || modifie.length === 0) {
    return "Modification impossible : ce produit n'est pas le vôtre, ou votre compte commerçant n'est plus actif.";
  }

  const { data: avant } = await supabase.from("product_images").select("storage_path").eq("product_id", opts.produitId);
  if (c.photos.length > 0) {
    const { error: erreurPhotos } = await supabase
      .from("product_images")
      .upsert(
        c.photos.map((storage_path, position) => ({ product_id: opts.produitId, storage_path, position })),
        { onConflict: "product_id,position" },
      );
    if (erreurPhotos) return lisible(erreurPhotos);
  }
  const { error: erreurReste } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", opts.produitId)
    .gte("position", c.photos.length);
  if (erreurReste) return lisible(erreurReste);

  // Le stockage suit la base, jamais l'inverse.
  await supprimerPhotosOrphelines((avant ?? []).map((i) => i.storage_path).filter((p) => !c.photos.includes(p)));

  if (opts.publier) {
    const { data, error: erreurPublication } = await supabase
      .from("products")
      .update({ status: "active" })
      .eq("id", opts.produitId)
      .eq("status", "draft")
      .select("id");
    if (erreurPublication) return lisible(erreurPublication);
    if (!data || data.length === 0) {
      return "Publication impossible : ce produit n'est plus un brouillon, ou votre compte commerçant n'est plus actif. Vos modifications sont enregistrées.";
    }
  }
  return null;
}

/** Le produit tel qu'on l'édite : champs bruts et chemins des photos, dans l'ordre. */
export async function lireProduitAEditer(produitId: string): Promise<(Saisie & { statut: string }) | null> {
  const [{ data, error }, { data: images }] = await Promise.all([
    supabase
      .from("products")
      .select("title, category_id, price_gnf, is_negotiable, description, status")
      .eq("id", produitId)
      .maybeSingle(),
    supabase.from("product_images").select("storage_path, position").eq("product_id", produitId).order("position"),
  ]);
  if (error) throw error;
  if (!data) return null;
  return {
    titre: data.title,
    categorieId: data.category_id,
    prix: formaterSaisiePrix(String(data.price_gnf)),
    negociable: data.is_negotiable,
    description: data.description ?? "",
    photos: (images ?? []).map((i) => i.storage_path),
    statut: data.status,
  };
}
