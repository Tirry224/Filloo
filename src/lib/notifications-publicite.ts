import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { prevenirDeLaReponse } from "@/lib/notifications-equipe";

/**
 * Le commerçant apprend chaque décision sur sa publicité (validée,
 * refusée, interrompue, remboursée, créée par l'équipe) par un message de
 * l'équipe dans le fil de SA BOUTIQUE (0044), puis une notification.
 * Avant, il devait revenir voir sa page (question 10.5 du document de
 * monétisation : « Comment informer un commerçant… ? »).
 *
 * Le message est écrit AVEC la session du membre de l'équipe : la policy
 * de `fil_equipe` exige qu'il signe de son nom. On ne cherche avec
 * `service_role` que l'adresse du commerçant (son `auth_user_id`).
 *
 * Jamais bloquant : la décision est déjà prise en base ; un message raté
 * se journalise, il n'annule rien.
 */
export async function informerDeLaCampagne(
  supabase: SupabaseClient<Database>,
  auteurId: string,
  campagneId: string,
  corps: (c: CampagnePourMessage) => string,
): Promise<void> {
  try {
    const { data, error } = await createAdminClient()
      .from("campagnes")
      .select(
        "type, fin_at, prix_gnf, products(title), merchants(shop_name, profiles(auth_user_id))",
      )
      .eq("id", campagneId)
      .single();
    const filDe = data?.merchants?.profiles?.auth_user_id;
    if (error || !data || !filDe) {
      console.error(`[publicité] commerçant de la campagne ${campagneId} introuvable :`, error?.message);
      return;
    }
    const texte = corps({
      cible: data.type === "boutique" ? `votre boutique « ${data.merchants?.shop_name ?? ""} »` : `« ${data.products?.title ?? "votre produit"} »`,
      finAt: data.fin_at,
      prixGnf: data.prix_gnf,
    });
    const { error: erreurMessage } = await supabase
      .from("fil_equipe")
      .insert({ fil_de: filDe, espace: "merchant", auteur_id: auteurId, de_l_equipe: true, corps: texte });
    if (erreurMessage) {
      console.error(`[publicité] message de la campagne ${campagneId} non écrit :`, erreurMessage.message);
      return;
    }
    await prevenirDeLaReponse(filDe, "merchant");
  } catch (cause) {
    console.error(`[publicité] commerçant non prévenu (campagne ${campagneId}) :`, cause);
  }
}

export type CampagnePourMessage = { cible: string; finAt: string | null; prixGnf: number | null };
