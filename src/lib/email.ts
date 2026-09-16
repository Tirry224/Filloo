/**
 * Envoi d'emails transactionnels, par l'API HTTP de Resend.
 *
 * POURQUOI PAS LE SDK `resend`
 * Envoyer un email, ici, c'est UN POST avec un en-tête d'autorisation et
 * du JSON. Une dépendance de plus se met à jour, casse, et pèse sur le
 * serveur — pour quinze lignes qui ne bougeront pas. Le projet compte
 * neuf dépendances de production : chacune doit se justifier.
 *
 * CE QUE CETTE FONCTION NE FAIT JAMAIS : lever une exception.
 * Elle est appelée depuis `after()` (voir `src/lib/notifications.ts`),
 * c'est-à-dire APRÈS que la réponse est partie : il n'y a plus personne
 * pour attraper quoi que ce soit, et une promesse rejetée là-bas ne
 * remonte à aucun écran. Elle rend donc compte de ce qui s'est passé au
 * lieu d'échouer — c'est la règle du projet (« une action dont on ne
 * peut pas savoir si elle a réussi est une action cassée »), appliquée
 * au seul endroit où l'appelant est un journal et non un humain.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Au-delà, on considère que Resend ne répondra pas. Sans cette borne, un
 * appel qui pend retient l'invocation serverless ouverte jusqu'à sa durée
 * maximale — on paierait une minute d'attente pour un email perdu. */
const TIMEOUT_MS = 10_000;

export type EmailOutcome =
  /** Resend a accepté l'email. Accepté n'est pas « reçu » : la
   * distribution, elle, ne se constate que dans le tableau de bord
   * Resend. C'est une limite connue de la v1, pas un oubli. */
  | { sent: true; id: string }
  /** L'envoi n'a pas eu lieu. `configured: false` distingue « le service
   * n'est pas branché » (l'état normal tant que la clé n'est pas posée)
   * d'une vraie panne : sans cette nuance, les journaux de développement
   * se remplissent d'alertes pour une configuration volontairement
   * absente, et on cesse de les lire. */
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

    /* Le corps de la réponse porte le motif du refus (domaine non
       vérifié, clé révoquée, destinataire invalide…). Le jeter pour ne
       garder que le code HTTP obligerait à rouvrir le tableau de bord
       Resend pour comprendre un 403 — autant le lire tout de suite. */
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
 * Le corps d'un message et le nom d'une boutique sont saisis par des
 * inconnus, et ils partent ici dans un document HTML. Sans cette
 * fonction, un message contenant `<a href="...">` arrive chez le
 * destinataire comme un VRAI lien, signé par notre domaine : c'est de
 * l'hameçonnage offert, et c'est la réputation d'envoi de Makiti qui
 * paie. Les clients mail n'exécutent pas de JavaScript, mais ils rendent
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
