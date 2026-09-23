import { NextResponse } from "next/server";
import { drainNotifications } from "@/lib/notifications-decisions";

/**
 * Appelée par Vercel Cron, avec `Authorization: Bearer $CRON_SECRET` —
 * seule façon d'entrer : cette adresse lit `auth.users` et envoie des
 * emails.
 *
 * `GET` parce que Vercel Cron n'émet que des `GET`, bien que la route
 * écrive.
 */

/* PAS de `export const dynamic = "force-dynamic"` : depuis Next 15 RC un
   handler `GET` est dynamique par défaut (voir `route.md`), et l'option est
   en retrait en 16 dès que Cache Components est activé. */

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Pas de secret posé = route FERMÉE : le défaut d'une protection doit
  // être le refus, sinon une variable oubliée ouvre l'envoi d'emails.
  if (!secret) {
    console.error("[notifications] CRON_SECRET absente : balayage refusé.");
    return NextResponse.json({ erreur: "non configurée" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    // 404 et non 401 : répondre « mauvais mot de passe » confirmerait à
    // un inconnu que l'adresse existe et vaut la peine d'être forcée.
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }

  try {
    const rapport = await drainNotifications();

    if (!rapport.configuree) {
      console.warn("[notifications] ni Resend ni les clés VAPID : rien n'a été envoyé.");
    } else if (rapport.echouees > 0) {
      console.error(`[notifications] ${rapport.echouees} envoi(s) en échec — voir la table notifications.`);
    } else if (rapport.envoyees > 0) {
      console.log(
        `[notifications] ${rapport.envoyees} décision(s) annoncée(s), dont ${rapport.poussees} sur un appareil.`,
      );
    }

    return NextResponse.json(rapport);
  } catch (cause) {
    console.error("[notifications] balayage impossible :", cause);
    return NextResponse.json({ erreur: "balayage impossible" }, { status: 500 });
  }
}
