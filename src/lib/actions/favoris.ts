"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { messagePourErreur } from "@/lib/erreurs";
import { estUuid } from "@/lib/saisie";

export type EtatFavori = { favori: boolean; error?: string };
export type CibleFavori = "boutique" | "produit";

/**
 * Ajoute ou retire une boutique (`favoris`, 0077) ou un produit
 * (`favoris_produits`, 0078) des favoris du client connecté. L'état VOULU
 * est envoyé (et non « bascule ») : deux appuis rapides ou deux onglets
 * ne peuvent pas s'annuler à contretemps. Le RLS refuse un profil
 * suspendu, une boutique ou un produit hors du catalogue public.
 *
 * `upsert … ignoreDuplicates` (insert on conflict do nothing) : sans cette
 * option, l'upsert demanderait un droit `update` que la base ne donne pas.
 */
export async function definirFavoriAction(cible: CibleFavori, id: string, favori: boolean): Promise<EtatFavori> {
  const refus = { favori: !favori };
  if (!estUuid(id)) return { ...refus, error: "Page plus à jour. Rechargez-la." };

  const supabase = await createClient();
  const client = await getMyProfile(supabase, "client");
  if (!client) return { ...refus, error: "Connectez-vous avec un compte client." };

  const { error } =
    cible === "boutique"
      ? favori
        ? await supabase.from("favoris").upsert({ client_id: client.id, merchant_id: id }, { ignoreDuplicates: true })
        : await supabase.from("favoris").delete().eq("client_id", client.id).eq("merchant_id", id)
      : favori
        ? await supabase
            .from("favoris_produits")
            .upsert({ client_id: client.id, product_id: id }, { ignoreDuplicates: true })
        : await supabase.from("favoris_produits").delete().eq("client_id", client.id).eq("product_id", id);
  if (error) return { ...refus, error: messagePourErreur(error, "favoris") };

  revalidatePath("/compte/favoris");
  return { favori };
}
