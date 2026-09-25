import { NextResponse } from "next/server";

/**
 * La porte des routes appelées par Vercel Cron, avec
 * `Authorization: Bearer $CRON_SECRET` — seule façon d'entrer : elles
 * écrivent, lisent `auth.users` ou effacent des fichiers.
 *
 * Renvoie la réponse de refus, ou `null` si l'appel est autorisé.
 */
export function refusCron(request: Request, nom: string): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  // Pas de secret posé = route FERMÉE : le défaut d'une protection doit
  // être le refus, sinon une variable oubliée ouvre la route à tous.
  if (!secret) {
    console.error(`[${nom}] CRON_SECRET absente : appel refusé.`);
    return NextResponse.json({ erreur: "non configurée" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    // 404 et non 401 : répondre « mauvais mot de passe » confirmerait à
    // un inconnu que l'adresse existe et vaut la peine d'être forcée.
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }

  return null;
}
