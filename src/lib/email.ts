/**
 * Envoi d'emails transactionnels, par l'API HTTP de Resend — pas le SDK,
 * qui n'ajouterait qu'un POST JSON à nos neuf dépendances.
 *
 * `sendEmail` NE LÈVE JAMAIS : appelée depuis `after()` (voir
 * `src/lib/notifications.ts`), donc après le départ de la réponse, où une
 * promesse rejetée ne remonterait à aucun écran.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Sans cette borne, un appel qui pend retient l'invocation serverless
 * jusqu'à sa durée maximale : une minute payée pour un email perdu. */
const TIMEOUT_MS = 10_000;

export type EmailOutcome =
  /** Accepté par Resend — ce qui n'est pas « reçu » : la distribution ne
   * se constate que dans leur tableau de bord. Limite connue de la v1. */
  | { sent: true; id: string }
  /** `configured: false` distingue « service non branché », normal tant
   * que la clé n'est pas posée, d'une vraie panne — sans quoi les journaux
   * s'emplissent d'alertes qu'on cesse de lire. */
  | { sent: false; configured: boolean; reason: string };

type EmailToSend = {
  to: string;
  subject: string;
  /** Toujours fourni : certains clients mail, et la plupart des
   * passerelles SMS-vers-email, n'affichent que lui. */
  text: string;
  html: string;
};

export async function sendEmail(email: EmailToSend): Promise<EmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return {
      sent: false,
      configured: false,
      reason: "RESEND_API_KEY ou EMAIL_FROM absente : aucun email ne part.",
    };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    // Le corps porte le motif du refus (domaine non vérifié, clé révoquée,
    // destinataire invalide…) ; sans lui, un 403 est indéchiffrable.
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        sent: false,
        configured: true,
        reason: `Resend a refusé l'envoi (HTTP ${response.status}) ${detail}`.trim(),
      };
    }

    const body = (await response.json()) as { id?: string };
    return { sent: true, id: body.id ?? "" };
  } catch (cause) {
    // Réseau injoignable, DNS, ou le délai ci-dessus dépassé.
    return {
      sent: false,
      configured: true,
      reason: cause instanceof Error ? cause.message : "Envoi impossible.",
    };
  }
}

/**
 * Échappe ce qui vient d'un humain avant de le coller dans du HTML.
 *
 * Les clients mail n'exécutent pas de JavaScript mais rendent très bien
 * liens et images : sans cet échappement, un message contenant
 * `<a href="...">` devient un vrai lien signé par notre domaine.
 */
export function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * L'enveloppe HTML commune à tous les emails de Makiti : un email qui ne
 * ressemble pas aux autres du même domaine ressemble à de l'hameçonnage.
 * Volontairement pauvre — une `div`, ni style externe, ni image, ni
 * police — c'est ce que tous les clients mail rendent pareil.
 *
 * ATTENTION : `content` doit arriver DÉJÀ échappé (`escapeHtml`). */
export function emailShell(content: string): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#faf6f0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#2b2320;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6ddd2;border-radius:12px;padding:24px;">
${content}
    </div>
  </body>
</html>`;
}

/** À doubler par l'adresse en clair dans la version texte : tous les
 * clients mail n'affichent pas les liens stylés. */
export function emailButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#c1613a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a>`;
}

/** Dit POURQUOI cet email arrive : sans cette phrase, qui ne se souvient
 * pas s'être inscrit le signale comme indésirable, et le domaine le paie. */
export function emailFooter(reason: string): string {
  return `<p style="margin:24px 0 0;color:#6b5d52;font-size:13px;">${escapeHtml(reason)}</p>`;
}
