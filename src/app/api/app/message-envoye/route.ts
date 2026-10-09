import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { notifyNewMessage } from "@/lib/notifications";
import { estUuid } from "@/lib/saisie";

/**
 * Prévenir le destinataire d'un message envoyé depuis l'APP MOBILE.
 *
 * Le site appelle `notifyNewMessage` dans `sendMessageAction`, sur son
 * serveur. L'app, elle, écrit le message directement en base (RLS) et n'a
 * pas de serveur : sans cette route, personne n'était prévenu. Elle
 * réutilise donc le même envoi (push et email), plutôt qu'un second
 * exemplaire dans une fonction Supabase qui finirait par diverger.
 *
 * Pas de cookie ici : l'app s'authentifie par son jeton Supabase
 * (`Authorization: Bearer`). Le jeton est vérifié par Supabase, puis le
 * message est relu AVEC ce jeton, donc à travers le RLS : on ne peut
 * déclencher que la notification d'un message que l'on a soi-même envoyé,
 * et il y a peu, pour qu'on ne puisse pas rejouer celle d'un vieux message
 * en boucle.
 */

/** Au-delà, le message n'est plus « nouveau » : la notification ne part pas. */
const FRAICHEUR_MS = 2 * 60 * 1000;

export async function POST(request: Request) {
  const jeton = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!jeton) return NextResponse.json({ erreur: "jeton absent" }, { status: 401 });

  let corps: { messageId?: unknown };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "corps illisible" }, { status: 400 });
  }
  const messageId = corps?.messageId;
  if (!estUuid(messageId)) return NextResponse.json({ erreur: "message invalide" }, { status: 400 });

  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${jeton}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: utilisateur, error: erreurJeton } = await supabase.auth.getUser(jeton);
  if (erreurJeton || !utilisateur.user) return NextResponse.json({ erreur: "jeton refusé" }, { status: 401 });

  const [{ data: message }, { data: profils }] = await Promise.all([
    supabase.from("messages").select("sender_id, created_at").eq("id", messageId).maybeSingle(),
    supabase.from("profiles").select("id").eq("auth_user_id", utilisateur.user.id),
  ]);
  const mien = message && (profils ?? []).some((p) => p.id === message.sender_id);
  if (!message || !mien) return NextResponse.json({ erreur: "message introuvable" }, { status: 404 });
  if (Date.now() - new Date(message.created_at).getTime() > FRAICHEUR_MS) {
    return NextResponse.json({ erreur: "message trop ancien" }, { status: 409 });
  }

  // Après la réponse, comme sur le site : l'app n'attend pas Resend.
  after(() => notifyNewMessage(messageId));
  return NextResponse.json({ envoye: true });
}
