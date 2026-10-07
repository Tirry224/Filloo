import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { lireBoutique, lireProduitsBoutique, type FicheBoutique, type Produit } from "./catalogue";
import { useSession } from "./session";
import { supabase } from "./supabase";

/**
 * L'espace commerçant : mêmes requêtes que `src/lib/data/merchants.ts` et
 * `src/lib/actions/products.ts` du site. Le RLS laisse le propriétaire
 * voir TOUS ses produits (brouillons et masqués compris) et refuse tout
 * le reste ; l'app ne fait que présenter ce que la base accepte.
 */

export type CompteCommercant = {
  profilId: string;
  suspendu: boolean;
  /** `null` tant que la boutique n'est pas créée (inscription en deux temps). */
  boutique: FicheBoutique | null;
};

export async function lireCompteCommercant(authUserId: string): Promise<CompteCommercant | null> {
  const { data: profil, error } = await supabase
    .from("profiles")
    .select("id, is_suspended, is_deleted")
    .eq("auth_user_id", authUserId)
    .eq("role", "merchant")
    .maybeSingle();
  if (error) throw error;
  if (!profil || profil.is_deleted) return null;
  const { data: m, error: erreurBoutique } = await supabase
    .from("merchants")
    .select("id")
    .eq("profile_id", profil.id)
    .maybeSingle();
  if (erreurBoutique) throw erreurBoutique;
  return { profilId: profil.id, suspendu: profil.is_suspended, boutique: m ? await lireBoutique(m.id) : null };
}

/** Le compte commerçant de la connexion, rechargeable après une création ou une modification. */
export function useCompteCommercant() {
  const { session, chargement } = useSession();
  const [compte, setCompte] = useState<CompteCommercant | null | undefined>(undefined);
  const [erreur, setErreur] = useState(false);

  const recharger = useCallback(async () => {
    if (!session) {
      setCompte(null);
      return;
    }
    setErreur(false);
    try {
      setCompte(await lireCompteCommercant(session.user.id));
    } catch {
      setErreur(true);
    }
  }, [session]);

  useEffect(() => {
    if (!chargement) recharger();
  }, [chargement, recharger]);

  return { session, compte, erreur, recharger };
}

/** Mes produits, tous statuts confondus, du plus récent au plus ancien. */
export const lireMesProduits = (boutique: FicheBoutique): Promise<Produit[]> => lireProduitsBoutique(boutique);

/** Les messages de `products.ts` du site après chaque changement d'état. */
export const STATUT_FAIT = {
  active: "Produit publié. Il est visible dans le catalogue.",
  sold: "Produit marqué comme vendu.",
  hidden: "Produit masqué du catalogue.",
} as const;

/**
 * Vendu, masqué, republié. « Pas d'erreur » ne veut pas dire « fait » :
 * le trigger `products_check_publishable` peut refuser (sans photo), et le
 * RLS écarte en silence — zéro ligne — ce qui n'est pas à moi.
 * Renvoie le texte d'erreur, ou `null`.
 */
export async function changerStatut(produitId: string, statut: "active" | "sold" | "hidden"): Promise<string | null> {
  const { data, error } = await supabase.from("products").update({ status: statut }).eq("id", produitId).select("id");
  if (error) return error.code === "P0001" ? error.message : "Action impossible. Réessayez dans un instant.";
  if (!data || data.length === 0) return "Action impossible : ce produit n'existe plus, ou il n'est pas le vôtre.";
  return null;
}

/**
 * Suppression définitive. Les messages qui citent le produit sont gardés
 * (`on delete set null`, 0001). Les chemins des photos se lisent AVANT :
 * la cascade efface `product_images`, seul endroit où ils sont écrits.
 * Un fichier encore cité par un autre produit n'est pas détruit.
 */
export async function supprimerProduit(produitId: string): Promise<string | null> {
  const { data: images } = await supabase.from("product_images").select("storage_path").eq("product_id", produitId);
  const { data, error } = await supabase.from("products").delete().eq("id", produitId).select("id");
  if (error) return "Suppression impossible. Réessayez dans un instant.";
  if (!data || data.length === 0) return "Suppression impossible : ce produit n'existe plus, ou il n'est pas le vôtre.";
  await supprimerPhotosOrphelines((images ?? []).map((i) => i.storage_path));
  return null;
}

/** Best effort, après la base : un fichier orphelin coûte moins cher qu'une vignette vide. */
export async function supprimerPhotosOrphelines(chemins: string[]): Promise<void> {
  if (chemins.length === 0) return;
  const { data: encoreCites } = await supabase.from("product_images").select("storage_path").in("storage_path", chemins);
  const cites = new Set((encoreCites ?? []).map((i) => i.storage_path));
  const orphelins = chemins.filter((c) => !cites.has(c));
  if (orphelins.length === 0) return;
  const { error } = await supabase.storage.from("product-images").remove(orphelins);
  if (error) console.error("[produits] photos restées dans le stockage :", error.message);
}

/**
 * Le dernier espace ouvert, pour rouvrir l'app au même endroit quand la
 * connexion porte les deux comptes (comme le cookie `filloo-espace` du site).
 */
const CLE_ESPACE = "filloo.espace";
export type Espace = "client" | "merchant";

export async function retenirEspace(espace: Espace) {
  try {
    await AsyncStorage.setItem(CLE_ESPACE, espace);
  } catch {}
}

export async function lireEspace(): Promise<Espace | null> {
  try {
    const v = await AsyncStorage.getItem(CLE_ESPACE);
    return v === "merchant" || v === "client" ? v : null;
  } catch {
    return null;
  }
}
