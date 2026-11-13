import * as Sentry from "@sentry/nextjs";
import { anonymiser } from "@/lib/erreurs-anonymes";

/**
 * Suivi des erreurs du SERVEUR seulement (pages rendues, routes, actions,
 * proxy). Rien côté navigateur : mesuré le 2026-10-14, le SDK navigateur
 * ajoute 72 Ko gzip au socle (165 → 237 Ko, budget 200 Ko).
 *
 * Sans `SENTRY_DSN`, rien ne s'initialise et rien ne part : la préversion
 * et le poste local restent muets tant que la variable n'est pas posée.
 *
 * Aucune donnée personnelle : `sendDefaultPii` à `false` ne suffit pas
 * (le cookie de session partait quand même), `anonymiser` passe sur
 * chaque erreur avant l'envoi.
 */
export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    beforeSend: anonymiser,
    // Les erreurs seulement : le suivi de performance consommerait le quota
    // de l'offre gratuite sans répondre à la question « qu'est-ce qui casse ».
    tracesSampleRate: 0,
  });
}

/**
 * Chaque erreur du serveur part aussi sur Telegram (2026-11-13), une fois
 * par fenêtre de dix minutes pour un même message et une même route
 * (`alerterErreur`). Seuls le nom, le message et la route partent : ni
 * pile, ni en-têtes, ni cookies.
 */
export const onRequestError: typeof Sentry.captureRequestError = async (erreur, requete, contexte) => {
  Sentry.captureRequestError(erreur, requete, contexte);
  const { alerterErreur } = await import("@/lib/telegram");
  const e = erreur instanceof Error ? erreur : new Error(String(erreur));
  const route = contexte.routePath ?? requete.path.split("?")[0];
  const message = e.message.slice(0, 300);
  await alerterErreur(`${route}|${message}`, `🔥 Erreur serveur sur ${route}\n${e.name} : ${message}`);
};
