/**
 * Envoi d'emails transactionnels, par l'API HTTP de Resend.
 *
 * Pas le SDK `resend` : c'est un POST avec un en-tête et du JSON, et le
 * projet tient à neuf dépendances de production justifiées une à une.
 *
 * CETTE FONCTION NE LÈVE JAMAIS : elle est appelée depuis `after()` (voir
 * `src/lib/notifications.ts`), donc après le départ de la réponse, où une
 * promesse rejetée ne remonte à aucun écran. Elle rend compte de ce qui
 * s'est passé au lieu d'échouer.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Au-delà, on considère que Resend ne répondra pas : sans cette borne, un
 * appel qui pend retient l'invocation serverless jusqu'à sa durée
 * maximale — une minute payée pour un email perdu. */
const TIMEOUT_MS = 10_000;

export type EmailOutcome =
  /** Resend a accepté l'email. Accepté n'est pas « reçu » : la
   * distribution, elle, ne se constate que dans le tableau de bord
   * Resend. C'est une limite connue de la v1, pas un oubli. */
  | { sent: true; id: string }
  /** L'envoi n'a pas eu lieu. `configured: false` distingue « service non
   * branché » (normal tant que la clé n'est pas posée) d'une vraie panne :
   * sans cette nuance, les journaux se remplissent d'alertes pour une
   * configuration volontairement absente, et on cesse de les lire. */
  | { sent: false; configured: boolean; reason: string };

type EmailToSend = {
  to: string;
  subject: string;
  /** Toujours fourni : certains clients mail, et la plupart des
   * passerelles SMS-vers-email, n'affichent que celui-là. */
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

    /* Le corps porte le motif du refus (domaine non vérifié, clé révoquée,
       destinataire invalide…) : sans lui, comprendre un 403 oblige à
       rouvrir le tableau de bord Resend. */
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
 * Corps de message et nom de boutique sont saisis par des inconnus et
 * partent dans un document HTML. Sans cet échappement, un message
 * contenant `<a href="...">` arrive comme un VRAI lien signé par notre
 * domaine : de l'hameçonnage offert, payé par la réputation d'envoi de
 * Makiti. Les clients mail n'exécutent pas de JavaScript, mais ils rendent
 * très bien les liens et les images.
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
 * L'enveloppe HTML commune à tous les emails de Makiti : des copies du même
 * `<!doctype html>` divergeraient au premier changement de couleur, et un
 * email qui ne ressemble pas aux autres du même domaine ressemble à de
 * l'hameçonnage.
 *
 * Volontairement pauvre — une `div`, pas de style externe, pas d'image,
 * pas de police : c'est ce que tous les clients mail rendent pareil, et ça
 * reste léger sur un forfait compté.
 *
 * ATTENTION : `content` doit arriver DÉJÀ ÉCHAPPÉ (`escapeHtml`), cette
 * fonction ne peut pas distinguer ce qui vient d'un humain de ce qui vient
 * de nous.
 */
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

/** Le bouton d'action, à doubler par l'adresse en clair dans la version
 * texte : tous les clients mail n'affichent pas les liens stylés. */
export function emailButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#c1613a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a>`;
}

/** Le pied de page, qui dit POURQUOI cet email arrive : sans cette phrase,
 * des gens qui ne se souviennent pas s'être inscrits le signalent comme
 * indésirable, et c'est le domaine entier qui le paie. */
export function emailFooter(reason: string): string {
  return `<p style="margin:24px 0 0;color:#6b5d52;font-size:13px;">${escapeHtml(reason)}</p>`;
}
