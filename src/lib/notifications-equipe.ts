import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { premiereAnnonce } from "@/lib/notifications-une-fois";

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

/** L'adresse d'« Équipe Filloo » dans chaque espace (0044) : le site et
 *  l'app mobile ont les mêmes. `/equipe` aiguille vers l'espace où la
 *  personne se trouve, pour une annonce « tous » qui vaut pour les deux. */
const CHEMIN_EQUIPE = { client: "/compte/equipe", merchant: "/vendeur/equipe" } as const;
const CHEMIN_DE_L_ANNONCE = { tous: "/equipe", clients: CHEMIN_EQUIPE.client, commercants: CHEMIN_EQUIPE.merchant } as const;

/** Une personne vient d'écrire à l'équipe : chaque membre est prévenu. */
export async function prevenirLEquipe(messageId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: message, error } = await admin
      .from("fil_equipe")
      .select("fil_de, espace, de_l_equipe, created_at")
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
      .eq("espace", message.espace)
      .eq("de_l_equipe", false)
      .neq("id", messageId)
      .gte("created_at", new Date(new Date(message.created_at).getTime() - SILENCE_MS).toISOString())
      .lte("created_at", message.created_at);
    if ((count ?? 0) > 0) return;

    const [{ data: profils }, { data: membres, error: erreurMembres }] = await Promise.all([
      admin
        .from("profiles")
        .select("full_name, merchants(shop_name)")
        .eq("auth_user_id", message.fil_de)
        .eq("role", message.espace)
        .eq("is_deleted", false)
        .limit(1)
        .returns<{ full_name: string; merchants: { shop_name: string } | null }[]>(),
      admin.from("equipe").select("auth_user_id"),
    ]);
    if (erreurMembres) {
      console.error("[equipe] membres illisibles :", erreurMembres.message);
      return;
    }
    // Côté boutique, l'équipe reconnaît la boutique plutôt que la personne.
    const nom = profils?.[0]?.merchants?.shop_name ?? profils?.[0]?.full_name ?? "Quelqu'un";
    const de = message.espace === "merchant" ? "la boutique" : "";
    // Une seule sonnerie par message, quel que soit le nombre d'appels (voir `notifications-une-fois.ts`).
    if (!(await premiereAnnonce(`equipe:${messageId}`))) return;

    await Promise.all(
      (membres ?? [])
        // On ne se prévient pas soi-même, si un collègue écrit dans son propre fil.
        .filter((m) => m.auth_user_id !== message.fil_de)
        .map((m) =>
          sendPushToUser(m.auth_user_id, {
            titre: `Message de ${de ? `${de} ` : ""}${nom}`,
            corps: "Nouveau message pour l'équipe Filloo.",
            url: `/admin/fil/${message.fil_de}?espace=${message.espace}`,
            tag: `equipe-${message.fil_de}-${message.espace}`,
          }),
        ),
    );
  } catch (cause) {
    console.error(`[equipe] alerte impossible (message ${messageId}) :`, cause);
  }
}

/** L'équipe vient de répondre : la personne est prévenue (navigateur abonné et téléphone). */
export async function prevenirDeLaReponse(filDe: string, espace: "client" | "merchant"): Promise<void> {
  try {
    await sendPushToUser(filDe, {
      titre: "Équipe Filloo",
      corps: espace === "merchant" ? "L'équipe a répondu à votre boutique." : "L'équipe vous a répondu.",
      // La notification ouvre la discussion, où la réponse est en bas.
      url: `${CHEMIN_EQUIPE[espace]}/discussion`,
      tag: `equipe-${espace}`,
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
      admin.from("annonces").select("titre, public").eq("id", annonceId).single(),
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
          sendPushToUser(id, {
            titre: "Équipe Filloo",
            corps: annonce.titre,
            url: CHEMIN_DE_L_ANNONCE[annonce.public],
            tag: `annonce-${annonceId}`,
          }),
        ),
      );
    }
  } catch (cause) {
    console.error(`[equipe] annonce ${annonceId} non envoyée :`, cause);
  }
}

/**
 * Le passage du matin (`/api/quotidien`, 7 h à Conakry) : publier les
 * annonces programmées pour aujourd'hui (0045), puis prévenir leurs
 * destinataires. Rend le nombre d'annonces publiées.
 */
export async function publierAnnoncesProgrammees(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("publier_annonces_programmees");
  if (error) throw error;
  for (const id of data ?? []) await annoncerAuxDestinataires(id);
  return data?.length ?? 0;
}
