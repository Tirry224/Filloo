import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToPhones, sendPushToUser } from "@/lib/push";

/**
 * Les notifications du fil avec l'équipe (0042), par NOTIFICATION
 * seulement — le site n'envoie plus d'email depuis le 2026-10-07.
 *
 * `service_role` : les appareils d'une personne ne sont lisibles que par
 * elle (RLS), alors que l'envoi part de l'autre côté du fil.
 *
 * Le corps d'un message ne part jamais : un écran verrouillé se lit
 * par-dessus l'épaule (même règle que `notifications.ts`).
 */

/** Une personne qui écrit trois messages d'affilée ne fait sonner l'équipe qu'une fois. */
const SILENCE_MS = 15 * 60 * 1000;

/** Le chemin de l'app où vivent les annonces et le fil (`src/app/equipe.tsx` de l'app). */
const CHEMIN_APP = "/equipe";

/** Une personne vient d'écrire à l'équipe : chaque membre est prévenu. */
export async function prevenirLEquipe(messageId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: message, error } = await admin
      .from("fil_equipe")
      .select("fil_de, de_l_equipe, created_at")
      .eq("id", messageId)
      .single();
    if (error || !message) {
      console.error(`[equipe] message ${messageId} illisible :`, error?.message);
      return;
    }
    if (message.de_l_equipe) return;

    // Un message de la même personne il y a peu : l'équipe a déjà sonné.
    const { count } = await admin
      .from("fil_equipe")
      .select("id", { count: "exact", head: true })
      .eq("fil_de", message.fil_de)
      .eq("de_l_equipe", false)
      .neq("id", messageId)
      .gte("created_at", new Date(new Date(message.created_at).getTime() - SILENCE_MS).toISOString())
      .lte("created_at", message.created_at);
    if ((count ?? 0) > 0) return;

    const [{ data: profils }, { data: membres, error: erreurMembres }] = await Promise.all([
      admin
        .from("profiles")
        .select("full_name")
        .eq("auth_user_id", message.fil_de)
        .eq("is_deleted", false)
        .order("created_at")
        .limit(1),
      admin.from("equipe").select("auth_user_id"),
    ]);
    if (erreurMembres) {
      console.error("[equipe] membres illisibles :", erreurMembres.message);
      return;
    }
    const nom = profils?.[0]?.full_name ?? "Quelqu'un";

    await Promise.all(
      (membres ?? [])
        // On ne se prévient pas soi-même, si un collègue écrit dans son propre fil.
        .filter((m) => m.auth_user_id !== message.fil_de)
        .map((m) =>
          sendPushToUser(m.auth_user_id, {
            titre: `Message de ${nom}`,
            corps: "Nouveau message pour l'équipe Filloo.",
            url: `/admin/fil/${message.fil_de}`,
            tag: `equipe-${message.fil_de}`,
          }),
        ),
    );
  } catch (cause) {
    console.error(`[equipe] alerte impossible (message ${messageId}) :`, cause);
  }
}

/** L'équipe vient de répondre : la personne est prévenue sur son téléphone. */
export async function prevenirDeLaReponse(filDe: string): Promise<void> {
  try {
    await sendPushToPhones(filDe, {
      titre: "Équipe Filloo",
      corps: "L'équipe vous a répondu.",
      url: CHEMIN_APP,
      tag: "equipe",
    });
  } catch (cause) {
    console.error(`[equipe] réponse non annoncée (fil ${filDe}) :`, cause);
  }
}

/** Par paquets : quelques centaines de destinataires sans ouvrir autant de connexions d'un coup. */
const PAQUET = 10;

/** Une annonce vient d'être publiée : chaque destinataire est prévenu. */
export async function annoncerAuxDestinataires(annonceId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const [{ data: annonce, error }, { data: destinataires, error: erreurDest }] = await Promise.all([
      admin.from("annonces").select("titre").eq("id", annonceId).single(),
      admin.from("annonce_destinataires").select("auth_user_id").eq("annonce_id", annonceId),
    ]);
    if (error || erreurDest || !annonce) {
      console.error(`[equipe] annonce ${annonceId} illisible :`, error?.message ?? erreurDest?.message);
      return;
    }
    const ids = (destinataires ?? []).map((d) => d.auth_user_id);
    for (let i = 0; i < ids.length; i += PAQUET) {
      await Promise.all(
        ids.slice(i, i + PAQUET).map((id) =>
          sendPushToPhones(id, { titre: "Équipe Filloo", corps: annonce.titre, url: CHEMIN_APP, tag: `annonce-${annonceId}` }),
        ),
      );
    }
  } catch (cause) {
    console.error(`[equipe] annonce ${annonceId} non envoyée :`, cause);
  }
}
