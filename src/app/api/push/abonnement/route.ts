import { NextResponse } from "next/server";
import { savePushSubscriptionAction } from "@/lib/actions/push";

/**
 * Le réabonnement automatique, appelé par `public/sw.js`.
 *
 * POURQUOI UNE ROUTE ALORS QU'UNE ACTION SERVEUR EXISTE DÉJÀ
 * Un service worker n'est pas une page React : il ne peut pas appeler une
 * action serveur, il ne sait faire qu'une requête HTTP. Cette route est
 * donc une porte d'entrée minimale vers l'action qui existe déjà — elle
 * ne duplique aucune règle, elle la relaie.
 *
 * QUAND ELLE SERT
 * Uniquement sur `pushsubscriptionchange` : le service de push (Google,
 * Apple, Mozilla) a révoqué l'abonnement d'un appareil et en a créé un
 * neuf. Sans cette route, le téléphone cesserait silencieusement de
 * recevoir les notifications, et personne — ni la personne, ni nous — ne
 * s'en apercevrait avant qu'un commerçant se plaigne de ne rien recevoir.
 *
 * QUI PEUT L'APPELER
 * Le `fetch` d'un service worker porte les cookies de son origine, donc
 * l'action retrouve la session normalement. Un appel anonyme, lui, se
 * heurte au « Vous devez être connecté » de l'action, puis au RLS de
 * `0023` : on ne peut pas abonner un appareil au nom de quelqu'un d'autre,
 * même en connaissant son identifiant.
 */
export async function POST(request: Request) {
  let corps: { abonnement?: unknown };
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

  /* 403 et non 400 quand l'action refuse : le corps était valide, c'est
     le droit qui manque. Un service worker ne lit pas ces messages — ils
     sont pour les journaux Vercel, le jour où un réabonnement échouera en
     silence. */
  if (resultat.error) {
    return NextResponse.json({ erreur: resultat.error }, { status: 403 });
  }

  return NextResponse.json({ enregistre: true });
}
