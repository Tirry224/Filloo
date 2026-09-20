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

/**
 * Annoncer — par notification ET par email — les trois décisions prises
 * dans le tableau de bord Supabase : boutique validée, refusée, compte
 * suspendu.
 *
 * LE PENDANT DE `notifications.ts`, ET DIFFÉRENT EXPRÈS. Là-bas une action
 * serveur vient d'écrire un message : elle sait qui prévenir, et `after()`
 * suffit. Ici personne n'a exécuté de code — quelqu'un a coché une case sur
 * supabase.com. Ce sont les triggers de `0021` qui laissent une trace, et
 * ce balayage la relève.
 *
 * TOUT L'ÉTAT VIT EN BASE : cette fonction n'a aucune mémoire. Un
 * déploiement au milieu, un timeout, une invocation tuée — le passage
 * suivant reprend là où celui-ci s'est arrêté, puisque ce qui n'est pas
 * marqué est encore en attente. Ce qui coince se voit en une requête :
 *
 *     select * from notifications where sent_at is null;
 *
 * Le cron ne passe qu'une fois par jour (offre Hobby, `vercel.json`) : le
 * push ne raccourcit pas ce délai, il fait arriver la nouvelle sur un écran
 * verrouillé au lieu d'attendre qu'on pense à ouvrir sa boîte mail.
 */

/** Assez petit pour tenir largement dans une invocation serverless, et
 *  pour qu'un lot raté ne bloque pas le suivant. Au rythme réel du
 *  projet — des validations à la main, une par une — vingt est déjà un
 *  plafond théorique. */
const TAILLE_DU_LOT = 20;

/** Au-delà, on cesse de réessayer. Une adresse invalide réessayée toutes
 *  les dix minutes indéfiniment finit par abîmer la réputation d'envoi
 *  du domaine — c'est-à-dire par faire tomber TOUS les emails, y compris
 *  ceux qui marchaient. La ligne reste en base, non envoyée, avec son
 *  motif : elle est visible, ce qui est le seul but. */
const TENTATIVES_MAX = 5;

export type DrainReport = {
  /** `false` quand AUCUN canal n'est branché — ni Resend, ni les clés
   *  VAPID : l'état normal tant que les variables ne sont pas posées, et
   *  surtout PAS une panne. */
  configuree: boolean;
  lues: number;
  envoyees: number;
  /** Décisions pour lesquelles au moins un appareil a été prévenu. Compté
   *  à part des emails : les deux canaux ne réussissent pas ensemble. */
  poussees: number;
  /** Rien à envoyer, définitivement : compte supprimé, ou décision déjà
   *  reprise avant le passage du balayage. */
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

  /* DEUX CANAUX, DEUX CONFIGURATIONS, ET AUCUN QUI DÉPENDE DE L'AUTRE.
     C'est la règle déjà écrite dans `notifyNewMessage`, appliquée ici :
     l'email s'allume avec Resend, le push avec les clés VAPID, et l'un
     éteint ne doit pas emporter l'autre. L'email a besoin de `siteUrl`
     en plus — ses liens sont lus dans une boîte mail, donc absolus ;
     ceux du push sont relatifs et s'ouvrent dans l'application. */
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const emailPossible = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && siteUrl);
  const pushPret = Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );

  /* Même garde qu'ailleurs, et au même endroit : AVANT la moindre
     requête. Un service éteint ne doit rien coûter — surtout pas six
     allers-retours en base par passage pour découvrir qu'on n'enverra
     rien. */
  if (!emailPossible && !pushPret) {
    return { ...vide, configuree: false };
  }

  const admin = createAdminClient();

  const { data: waiting, error } = await admin
    .from("notifications")
    .select("id, kind, profile_id, attempts")
    .is("sent_at", null)
    .lt("attempts", TENTATIVES_MAX)
    /* La plus ancienne d'abord : c'est celle dont la personne attend la
       réponse depuis le plus longtemps. */
    .order("created_at", { ascending: true })
    .limit(TAILLE_DU_LOT);
  if (error) throw error;

  const rapport: DrainReport = { ...vide, lues: waiting?.length ?? 0 };

  /* En SÉRIE, pas en parallèle. Vingt appels simultanés à Resend
     déclenchent sa limite de débit, et l'échec retombe alors sur des
     notifications parfaitement valides. Un lot de vingt envois
     séquentiels tient de toute façon dans une invocation. */
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

    /* LE PUSH D'ABORD, ET UNE SEULE FOIS — SAUF S'IL EST SEUL.
       D'abord parce qu'il arrive en secondes sur un écran verrouillé. Une
       seule fois quand un email doit suivre, parce que la ligne est rejouée
       tant que cet email n'est pas parti : sans cette borne, une adresse
       invalide ferait sonner le téléphone cinq fois pour une décision
       unique — le `tag` regroupe l'affichage, pas les vibrations.
       Mais quand le push est le SEUL canal, il EST ce qu'on réessaie : le
       borner au premier passage condamnerait la décision de quelqu'un qui
       n'avait aucun appareil abonné ce jour-là. */
    let atteints = 0;
    if (pushPret && (ligne.attempts === 0 || !composed.email)) {
      atteints = await sendPushToUser(composed.authUserId, composed.push);
      if (atteints > 0) rapport.poussees += 1;
    }

    if (!composed.email) {
      /* PUSH SEUL : Resend n'est pas branché. La décision est annoncée
         si — et seulement si — un appareil l'a reçue. Marquer « envoyée »
         une décision que personne n'a reçue la perdrait pour de bon,
         puisque rien ne relit une ligne marquée ; la laisser en échec la
         garde visible (`select * from notifications where sent_at is
         null`) et la fait cesser d'elle-même au bout de cinq tentatives. */
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
       *  `0023`) : c'est donc `auth_user_id` qui désigne les téléphones à
       *  prévenir, jamais `profile_id`. */
      authUserId: string;
      /** `null` quand Resend n'est pas branché : le push part quand même. */
      email: { to: string; subject: string; text: string; html: string } | null;
      push: ContenuPush;
    }
  /** Il n'y a plus rien à envoyer, et il n'y en aura plus jamais. */
  | { kind: "abandon"; raison: string }
  /** L'envoi n'a pas pu être préparé cette fois-ci — à réessayer. */
  | { kind: "echec"; raison: string };

/**
 * CE QUE LE PUSH NE DIT PAS DES DÉCISIONS. Un écran verrouillé se lit
 * par-dessus l'épaule — d'où deux textes sur trois volontairement muets :
 *
 * - « votre boutique est validée » s'annonce en clair : bonne nouvelle, et
 *   c'est le moment d'ouvrir l'application pour publier ses brouillons ;
 * - un REFUS et une SUSPENSION, non. Les lire par-dessus l'épaule de
 *   quelqu'un, dans un marché, c'est l'humilier pour un motif que lui seul
 *   devrait connaître. Le push dit qu'une décision attend, l'email — qui
 *   demande de déverrouiller son téléphone — dit laquelle et pourquoi.
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
  /** `null` quand l'email n'est pas configuré : on ne compose alors aucun
   *  texte, et on ne va surtout pas chercher une adresse dont personne ne
   *  se servira. */
  siteUrl: string | null,
): Promise<Composition> {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("auth_user_id, full_name, is_suspended, is_deleted")
    .eq("id", profileId)
    .single();
  /* Une erreur de lecture est passagère (réseau, base occupée) ; un
     profil absent ne l'est pas — la ligne référence pourtant une clé
     étrangère, donc ce cas ne devrait pas exister. On le distingue quand
     même : réessayer indéfiniment une ligne impossible, c'est exactement
     ce que le compteur de tentatives sert à éviter. */
  if (error) return { kind: "echec", raison: `profil illisible : ${error.message}` };
  if (!profile) return { kind: "abandon", raison: "profil introuvable" };

  /* Un compte supprimé est banni côté `auth.users` : l'email partirait
     vers quelqu'un qui ne peut plus se connecter pour agir dessus. Même
     règle que `notifyNewMessage`. */
  if (profile.is_deleted) return { kind: "abandon", raison: "compte supprimé" };

  /* L'adresse n'est cherchée QUE si un email doit partir — la même
     correction que dans `notifyNewMessage` : la chercher d'abord faisait
     tomber le push quand `auth.admin` répondait mal ou quand la connexion
     n'avait pas d'adresse lisible. Un canal ne doit jamais tomber à cause
     de la configuration d'un autre. */
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
    /* LA DÉCISION A PU ÊTRE REPRISE entre le trigger et ce passage :
       suspendre puis rétablir dans la minute est un geste banal quand on
       administre à la main. Annoncer une sanction levée serait pire que
       ne rien annoncer. */
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

  /* Le statut est relu MAINTENANT, et pas recopié dans la file : entre
     la décision et l'envoi, elle a pu être reprise. Annoncer « votre
     boutique est en ligne » à quelqu'un qui vient d'être remis en
     attente coûterait bien plus qu'un silence. */
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
  /* Un marquage raté renverra le même email au passage suivant. C'est le
     seul défaut assumé de ce mécanisme, et il va dans le bon sens :
     mieux vaut un doublon qu'un commerçant jamais prévenu. Mais il se
     journalise, parce qu'un doublon toutes les dix minutes n'est plus un
     défaut, c'est une boucle. */
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

/* ---------------------------------------------------------------------
   Les trois textes.

   Séparés de l'envoi pour être relus — et réécrits — sans toucher au
   transport, exactement comme `composeNewMessageEmail`. Ils se lisent
   d'affilée, ce qui est le seul moyen de vérifier qu'ils se ressemblent.
   --------------------------------------------------------------------- */

function approvalEmail(input: { to: string; siteUrl: string; name: string; shopName: string }) {
  const link = `${input.siteUrl}/vendeur`;
  const subject = `${input.shopName} est en ligne sur Makiti`;

  /* L'email dit quoi faire MAINTENANT, et pas seulement ce qui s'est
     passé. Un commerçant validé qui ne publie rien reste une boutique
     vide, c'est-à-dire le risque n° 1 de docs/SPEC.md. */
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

  /* Le MOTIF est le seul contenu utile de cet email. Un refus sans motif
     est un vendeur perdu définitivement (docs/REPRISE.md) — et un email
     de refus sans motif est pire encore, puisqu'il n'y a même pas
     d'écran à ouvrir pour le lire. Le repli existe parce que la base
     n'impose ce motif que depuis 0012 : des lignes plus anciennes
     peuvent encore en manquer. */
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

  /* Ce que cet email NE DIT PAS, et volontairement : le motif. La table
     `profiles` n'a pas de colonne pour ça (voir l'écran 19, qui a retiré
     le motif inventé par la maquette). Inventer une raison ici serait
     reproduire le même défaut dans un canal qu'on ne peut pas corriger
     après coup.

     Il dit en revanche ce qui reste possible — lire — parce que couper
     tout d'un coup pousse la personne à se recréer un compte, ce qui
     annule la sanction. */
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
