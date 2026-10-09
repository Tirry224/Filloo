import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser, type ContenuPush } from "@/lib/push";

/**
 * Le cron passe une fois par jour (offre Hobby, `vercel.json`).
 *
 * Par NOTIFICATION seulement depuis le 2026-10-07 : l'email est réservé au
 * compte (confirmation d'adresse, mot de passe oublié), décision du
 * porteur du projet. Une ligne qu'aucun appareil n'a reçue reste en base
 * et se réessaie au passage suivant.
 */

/** Assez petit pour tenir dans une invocation serverless et qu'un lot raté
 *  ne bloque pas le suivant. */
const TAILLE_DU_LOT = 20;

/** Au-delà, on cesse de réessayer : la personne n'a aucun appareil joignable.
 *  La ligne reste en base avec son motif, donc visible. */
const TENTATIVES_MAX = 5;

export type DrainReport = {
  configuree: boolean;
  lues: number;
  envoyees: number;
  poussees: number;
  abandonnees: number;
  echouees: number;
};

export async function drainNotifications(): Promise<DrainReport> {
  const vide: DrainReport = {
    configuree: true,
    lues: 0,
    envoyees: 0,
    poussees: 0,
    abandonnees: 0,
    echouees: 0,
  };

  const admin = createAdminClient();

  const { data: waiting, error } = await admin
    .from("notifications")
    .select("id, kind, profile_id, attempts")
    .is("sent_at", null)
    .lt("attempts", TENTATIVES_MAX)
    .order("created_at", { ascending: true })
    .limit(TAILLE_DU_LOT);
  if (error) throw error;

  const rapport: DrainReport = { ...vide, lues: waiting?.length ?? 0 };

  // En série : un lot de vingt reste petit, inutile de solliciter Expo en rafale.
  for (const ligne of waiting ?? []) {
    const composed = await composeFor(admin, ligne.kind, ligne.profile_id);

    if (composed.kind === "abandon") {
      await marquerTraitee(admin, ligne.id, composed.raison);
      rapport.abandonnees += 1;
      continue;
    }
    if (composed.kind === "echec") {
      await marquerEchouee(admin, ligne.id, ligne.attempts, composed.raison);
      rapport.echouees += 1;
      continue;
    }

    const atteints = await sendPushToUser(composed.authUserId, composed.push);
    if (atteints > 0) {
      await marquerTraitee(admin, ligne.id, null);
      rapport.poussees += 1;
      rapport.envoyees += 1;
    } else {
      await marquerEchouee(admin, ligne.id, ligne.attempts, "aucun appareil joignable");
      rapport.echouees += 1;
    }
  }

  return rapport;
}

type Admin = ReturnType<typeof createAdminClient>;

type Composition =
  | {
      kind: "envoi";
      /** L'appareil appartient à la CONNEXION, pas au profil (migration
       *  `0023`) : donc `auth_user_id`, jamais `profile_id`. */
      authUserId: string;
      push: ContenuPush;
    }
  | { kind: "abandon"; raison: string }
  | { kind: "echec"; raison: string };

/** Un écran verrouillé se lit par-dessus l'épaule : le push dit qu'une décision attend, l'app dit laquelle. */
const PUSH_SUSPENSION: ContenuPush = {
  titre: "Filloo",
  corps: "Une décision concernant votre compte vous attend.",
  url: "/compte/suspendu",
  tag: "decision-compte",
};

async function composeFor(
  admin: Admin,
  kind: "merchant_approved" | "merchant_rejected" | "profile_suspended",
  profileId: string,
): Promise<Composition> {
  if (kind !== "profile_suspended") {
    return { kind: "abandon", raison: "validation des boutiques supprimée" };
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select("auth_user_id, is_suspended, is_deleted")
    .eq("id", profileId)
    .single();
  if (error) return { kind: "echec", raison: `profil illisible : ${error.message}` };
  if (!profile) return { kind: "abandon", raison: "profil introuvable" };

  // Un compte supprimé ne peut plus se connecter pour agir dessus.
  if (profile.is_deleted) return { kind: "abandon", raison: "compte supprimé" };

  // La décision a pu être reprise entre le trigger et ce passage :
  // annoncer une sanction levée est pire que ne rien annoncer.
  if (!profile.is_suspended) return { kind: "abandon", raison: "suspension déjà levée" };
  return {
    kind: "envoi",
    authUserId: profile.auth_user_id,
    push: PUSH_SUSPENSION,
  };
}

async function marquerTraitee(admin: Admin, id: string, raison: string | null): Promise<void> {
  const { error } = await admin
    .from("notifications")
    .update({ sent_at: new Date().toISOString(), last_error: raison })
    .eq("id", id);
  if (error) console.error(`[notifications] marquage impossible (${id}) : ${error.message}`);
}

async function marquerEchouee(
  admin: Admin,
  id: string,
  attempts: number,
  raison: string,
): Promise<void> {
  const { error } = await admin
    .from("notifications")
    .update({ attempts: attempts + 1, last_error: raison })
    .eq("id", id);
  if (error) console.error(`[notifications] échec non consigné (${id}) : ${error.message}`);
}
