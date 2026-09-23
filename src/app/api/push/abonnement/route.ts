import { NextResponse } from "next/server";
import { deletePushSubscriptionAction, savePushSubscriptionAction } from "@/lib/actions/push";

/**
 * Le `fetch` d'un service worker porte les cookies de son origine, donc
 * l'action retrouve la session ; un appel anonyme se heurte à l'action puis
 * au RLS de `0023`.
 */
export async function POST(request: Request) {
  let corps: { abonnement?: unknown; ancienEndpoint?: unknown };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "corps illisible" }, { status: 400 });
  }

  const abonnement = corps?.abonnement as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!abonnement?.endpoint) {
    return NextResponse.json({ erreur: "abonnement absent" }, { status: 400 });
  }

  const resultat = await savePushSubscriptionAction(
    { endpoint: abonnement.endpoint, keys: abonnement.keys },
    request.headers.get("user-agent") ?? "",
  );

  if (resultat.error) {
    return NextResponse.json({ erreur: resultat.error }, { status: 403 });
  }

  /* L'ancienne ligne part APRÈS l'écriture de la nouvelle : l'ordre
     inverse laisserait, sur une coupure, un téléphone abonné côté
     navigateur et inconnu de la base. */
  const ancienEndpoint = typeof corps.ancienEndpoint === "string" ? corps.ancienEndpoint : "";
  if (ancienEndpoint && ancienEndpoint !== abonnement.endpoint) {
    const oubli = await deletePushSubscriptionAction(ancienEndpoint);
    if (oubli.error) console.error(`[push] ancien abonnement non supprimé : ${oubli.error}`);
  }

  return NextResponse.json({ enregistre: true });
}
