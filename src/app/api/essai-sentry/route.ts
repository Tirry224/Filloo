/**
 * TEMPORAIRE (2026-10-14) : prouve qu'une erreur du serveur arrive chez
 * Sentry, sur la préversion seulement. À retirer une fois constaté.
 */
export const dynamic = "force-dynamic";

export function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return new Response("Introuvable", { status: 404 });
  }
  throw new Error("Essai Sentry : erreur volontaire de la préversion");
}
