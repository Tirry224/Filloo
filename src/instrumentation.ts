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

export const onRequestError = Sentry.captureRequestError;
