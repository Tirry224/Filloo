import { NextResponse } from "next/server";
import { drainNotifications } from "@/lib/notifications-decisions";
import { refusCron } from "@/lib/cron";

/**
 * Les notifications seules, à lancer à la main (même porte que
 * `/api/quotidien`, qui l'enchaîne chaque matin avec le ménage) : cette
 * adresse lit `auth.users` et envoie des emails.
 *
 * `GET` parce que Vercel Cron n'émet que des `GET`, bien que la route
 * écrive.
 */

/* PAS de `export const dynamic = "force-dynamic"` : depuis Next 15 RC un
   handler `GET` est dynamique par défaut (voir `route.md`), et l'option est
   en retrait en 16 dès que Cache Components est activé. */

export async function GET(request: Request) {
  const refus = refusCron(request, "notifications");
  if (refus) return refus;

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
