"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { messagePourErreur } from "@/lib/erreurs";
import { estUuid } from "@/lib/saisie";

export type EtatFavori = { favori: boolean; error?: string };

/**
 * Ajoute ou retire une boutique des favoris du client connecté. L'état
 * VOULU est envoyé (et non « bascule ») : deux appuis rapides ou deux
 * onglets ouverts ne peuvent pas s'annuler l'un l'autre à contretemps.
 * Le RLS (0077) refuse un profil suspendu ou une boutique invisible.
 */
export async function definirFavoriAction(merchantId: string, favori: boolean): Promise<EtatFavori> {
  if (!estUuid(merchantId)) return { favori: !favori, error: "Boutique introuvable." };

  const supabase = await createClient();
  const client = await getMyProfile(supabase, "client");
  if (!client) return { favori: !favori, error: "Connectez-vous avec un compte client." };

  const { error } = favori
    ? await supabase
        .from("favoris")
        .upsert({ client_id: client.id, merchant_id: merchantId }, { ignoreDuplicates: true })
    : await supabase.from("favoris").delete().eq("client_id", client.id).eq("merchant_id", merchantId);
  if (error) return { favori: !favori, error: messagePourErreur(error, "favoris") };

  revalidatePath("/compte/favoris");
  return { favori };
}
