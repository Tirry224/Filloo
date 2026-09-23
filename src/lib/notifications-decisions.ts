import { createAdminClient } from "@/lib/supabase/admin";
import {
  emailButton,
  emailFooter,
  emailShell,
  escapeHtml,
  sendEmail,
  type EmailOutcome,
} from "@/lib/email";
import { sendPushToUser, type ContenuPush } from "@/lib/push";
import { siteUrl as adresseDuSite } from "@/lib/site-url";

/**
 * Le cron passe une fois par jour (offre Hobby, `vercel.json`).
 */

/** Assez petit pour tenir dans une invocation serverless et qu'un lot raté
 *  ne bloque pas le suivant. */
const TAILLE_DU_LOT = 20;

/** Au-delà, on cesse de réessayer : une adresse invalide rejouée sans fin
 *  abîme la réputation d'envoi du domaine, donc TOUS les emails. La ligne
 *  reste en base avec son motif, donc visible. */
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

  /* Deux canaux, deux configurations, aucun qui dépende de l'autre : un
     canal éteint ne doit pas emporter l'autre. L'email exige `siteUrl` en
     plus, ses liens étant lus dans une boîte mail donc absolus ; ceux du
     push sont relatifs et s'ouvrent dans l'application. */
  const siteUrl = adresseDuSite();
  const emailPossible = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && siteUrl);
  const pushPret = Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );

  if (!emailPossible && !pushPret) {
    return { ...vide, configuree: false };
  }

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

  /* En SÉRIE : vingt appels simultanés déclenchent la limite de débit de
     Resend, et l'échec retombe sur des notifications valides. */
  for (const ligne of waiting ?? []) {
    const composed = await composeFor(
      admin,
      ligne.kind,
      ligne.profile_id,
      emailPossible ? siteUrl : null,
    );

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

    /* Le push d'abord, car il arrive en secondes ; une seule fois quand un
       email doit suivre, la ligne étant rejouée tant qu'il n'est pas parti
       — sinon une adresse invalide fait sonner le téléphone cinq fois (le
       `tag` regroupe l'affichage, pas les vibrations). Seul canal, en
       revanche, il EST ce qu'on réessaie. */
    let atteints = 0;
    if (pushPret && (ligne.attempts === 0 || !composed.email)) {
      atteints = await sendPushToUser(composed.authUserId, composed.push);
      if (atteints > 0) rapport.poussees += 1;
    }

    if (!composed.email) {
      if (atteints > 0) {
        await marquerTraitee(admin, ligne.id, "annoncée par notification seule : email non configuré");
        rapport.envoyees += 1;
      } else {
        await marquerEchouee(admin, ligne.id, ligne.attempts, "aucun canal disponible : email non configuré, aucun appareil abonné");
        rapport.echouees += 1;
      }
      continue;
    }

    const outcome: EmailOutcome = await sendEmail(composed.email);
    if (outcome.sent) {
      await marquerTraitee(admin, ligne.id, null);
      rapport.envoyees += 1;
    } else {
      await marquerEchouee(admin, ligne.id, ligne.attempts, outcome.reason);
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
      email: { to: string; subject: string; text: string; html: string } | null;
      push: ContenuPush;
    }
  | { kind: "abandon"; raison: string }
  | { kind: "echec"; raison: string };

/**
 * Un écran verrouillé se lit par-dessus l'épaule : seule la validation
 * s'annonce en clair. Pour un refus ou une suspension, le push dit qu'une
 * décision attend ; l'email, qui exige de déverrouiller, dit laquelle.
 */
const PUSH_PAR_DECISION = {
  merchant_approved: (shopName: string): ContenuPush => ({
    titre: "Makiti",
    corps: `Votre boutique « ${shopName} » est validée. Publiez vos produits.`,
    url: "/vendeur",
    tag: "decision-boutique",
  }),
  merchant_rejected: (): ContenuPush => ({
    titre: "Makiti",
    corps: "Une décision concernant votre boutique vous attend.",
    url: "/vendeur/refusee",
    tag: "decision-boutique",
  }),
  profile_suspended: (): ContenuPush => ({
    titre: "Makiti",
    corps: "Une décision concernant votre compte vous attend.",
    url: "/compte/suspendu",
    tag: "decision-compte",
  }),
};

async function composeFor(
  admin: Admin,
  kind: "merchant_approved" | "merchant_rejected" | "profile_suspended",
  profileId: string,
  siteUrl: string | null,
): Promise<Composition> {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("auth_user_id, full_name, is_suspended, is_deleted")
    .eq("id", profileId)
    .single();
  if (error) return { kind: "echec", raison: `profil illisible : ${error.message}` };
  if (!profile) return { kind: "abandon", raison: "profil introuvable" };

  // Un compte supprimé est banni côté `auth.users` : l'email irait à
  // quelqu'un qui ne peut plus se connecter pour agir dessus.
  if (profile.is_deleted) return { kind: "abandon", raison: "compte supprimé" };

  // L'adresse n'est cherchée QUE si un email doit partir : la chercher
  // d'abord ferait tomber le push quand `auth.admin` répond mal.
  let to: string | null = null;
  if (siteUrl) {
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(
      profile.auth_user_id,
    );
    if (authError) return { kind: "echec", raison: `adresse illisible : ${authError.message}` };
    to = authUser?.user?.email ?? null;
    if (!to) return { kind: "abandon", raison: "aucune adresse email sur la connexion" };
  }

  if (kind === "profile_suspended") {
    // La décision a pu être reprise entre le trigger et ce passage :
    // annoncer une sanction levée est pire que ne rien annoncer.
    if (!profile.is_suspended) return { kind: "abandon", raison: "suspension déjà levée" };
    return {
      kind: "envoi",
      authUserId: profile.auth_user_id,
      email: to && siteUrl ? suspensionEmail({ to, siteUrl, name: profile.full_name }) : null,
      push: PUSH_PAR_DECISION.profile_suspended(),
    };
  }

  const { data: merchant, error: merchantError } = await admin
    .from("merchants")
    .select("shop_name, status, rejection_reason")
    .eq("profile_id", profileId)
    .single();
  if (merchantError) return { kind: "echec", raison: `boutique illisible : ${merchantError.message}` };
  if (!merchant) return { kind: "abandon", raison: "boutique introuvable" };

  // Statut relu MAINTENANT, jamais recopié dans la file : la décision a pu
  // être reprise entre-temps.
  if (kind === "merchant_approved") {
    if (merchant.status !== "approved") return { kind: "abandon", raison: "validation reprise" };
    return {
      kind: "envoi",
      authUserId: profile.auth_user_id,
      email:
        to && siteUrl
          ? approvalEmail({ to, siteUrl, name: profile.full_name, shopName: merchant.shop_name })
          : null,
      push: PUSH_PAR_DECISION.merchant_approved(merchant.shop_name),
    };
  }

  if (merchant.status !== "rejected") return { kind: "abandon", raison: "refus repris" };
  return {
    kind: "envoi",
    authUserId: profile.auth_user_id,
    email:
      to && siteUrl
        ? rejectionEmail({
            to,
            siteUrl,
            name: profile.full_name,
            shopName: merchant.shop_name,
            reason: merchant.rejection_reason,
          })
        : null,
    push: PUSH_PAR_DECISION.merchant_rejected(),
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

function approvalEmail(input: { to: string; siteUrl: string; name: string; shopName: string }) {
  const link = `${input.siteUrl}/vendeur`;
  const subject = `${input.shopName} est en ligne sur Makiti`;

  const text = [
    `Bonjour ${input.name},`,
    `Votre boutique « ${input.shopName} » a été validée : elle est visible par les clients sur Makiti.`,
    `Vos produits en brouillon peuvent maintenant être publiés — c'est ce qui vous rendra visible dans le fil.`,
    `Votre boutique : ${link}`,
  ].join("\n\n");

  const html = emailShell(`      <p style="margin:0 0 16px;">Bonjour ${escapeHtml(input.name)},</p>
      <p style="margin:0 0 16px;">Votre boutique <strong>${escapeHtml(input.shopName)}</strong> a été validée : elle est visible par les clients sur Makiti.</p>
      <p style="margin:0 0 24px;">Vos produits en brouillon peuvent maintenant être publiés — c'est ce qui vous rendra visible dans le fil.</p>
      ${emailButton(link, "Ouvrir ma boutique")}
      ${emailFooter("Vous recevez cet email parce que vous avez demandé l'ouverture d'une boutique sur Makiti.")}`);

  return { to: input.to, subject, text, html };
}

function rejectionEmail(input: {
  to: string;
  siteUrl: string;
  name: string;
  shopName: string;
  reason: string | null;
}) {
  const link = `${input.siteUrl}/vendeur/refusee`;
  const subject = `Votre boutique ${input.shopName} n'a pas été validée`;

  const motif =
    input.reason?.trim() ||
    "Aucun motif n'a été enregistré. Répondez à cet email pour en connaître la raison.";

  const text = [
    `Bonjour ${input.name},`,
    `Votre boutique « ${input.shopName} » n'a pas été validée pour le moment.`,
    `Motif : ${motif}`,
    `Vos produits en brouillon sont conservés. Corrigez ce qui est signalé, puis renvoyez votre boutique : ${link}`,
  ].join("\n\n");

  const html = emailShell(`      <p style="margin:0 0 16px;">Bonjour ${escapeHtml(input.name)},</p>
      <p style="margin:0 0 16px;">Votre boutique <strong>${escapeHtml(input.shopName)}</strong> n'a pas été validée pour le moment.</p>
      <blockquote style="margin:0 0 16px;padding:12px 16px;background:#faf6f0;border-left:3px solid #c1613a;white-space:pre-wrap;">${escapeHtml(motif)}</blockquote>
      <p style="margin:0 0 24px;">Vos produits en brouillon sont conservés. Corrigez ce qui est signalé, puis renvoyez votre boutique.</p>
      ${emailButton(link, "Renvoyer ma boutique")}
      ${emailFooter("Vous recevez cet email parce que vous avez demandé l'ouverture d'une boutique sur Makiti.")}`);

  return { to: input.to, subject, text, html };
}

function suspensionEmail(input: { to: string; siteUrl: string; name: string }) {
  const link = `${input.siteUrl}/compte/suspendu`;
  const subject = "Votre compte Makiti a été suspendu";

  const text = [
    `Bonjour ${input.name},`,
    `Votre compte Makiti a été suspendu : vous ne pouvez plus envoyer de messages ni publier.`,
    `Vous pouvez toujours consulter le catalogue, et vos conversations restent lisibles.`,
    `Si vous pensez qu'il s'agit d'une erreur, répondez à cet email.`,
    `Votre compte : ${link}`,
  ].join("\n\n");

  const html = emailShell(`      <p style="margin:0 0 16px;">Bonjour ${escapeHtml(input.name)},</p>
      <p style="margin:0 0 16px;">Votre compte Makiti a été <strong>suspendu</strong> : vous ne pouvez plus envoyer de messages ni publier.</p>
      <p style="margin:0 0 16px;">Vous pouvez toujours consulter le catalogue, et vos conversations restent lisibles.</p>
      <p style="margin:0 0 24px;">Si vous pensez qu'il s'agit d'une erreur, répondez à cet email.</p>
      ${emailButton(link, "Voir mon compte")}
      ${emailFooter("Vous recevez cet email parce que vous avez un compte Makiti.")}`);

  return { to: input.to, subject, text, html };
}
