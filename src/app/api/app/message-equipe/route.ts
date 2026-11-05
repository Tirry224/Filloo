import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { prevenirLEquipe } from "@/lib/notifications-equipe";
import { estUuid } from "@/lib/saisie";

/**
 * Prévenir l'équipe qu'une personne lui a écrit depuis l'APP MOBILE (0042).
 *
 * Même porte que `message-envoye` : l'app écrit le message en base (RLS),
 * puis appelle cette route avec son jeton Supabase. Le message est relu
 * AVEC ce jeton, donc à travers le RLS : on ne fait sonner l'équipe que
 * pour un message que l'on vient soi-même d'écrire.
 */

/** Au-delà, le message n'est plus « nouveau » : rien ne part. */
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

  const { data: message } = await supabase
    .from("fil_equipe")
    .select("fil_de, auteur_id, de_l_equipe, created_at")
    .eq("id", messageId)
    .maybeSingle();
  const mien = message && !message.de_l_equipe && message.auteur_id === utilisateur.user.id;
  if (!message || !mien) return NextResponse.json({ erreur: "message introuvable" }, { status: 404 });
  if (Date.now() - new Date(message.created_at).getTime() > FRAICHEUR_MS) {
    return NextResponse.json({ erreur: "message trop ancien" }, { status: 409 });
  }

  after(() => prevenirLEquipe(messageId));
  return NextResponse.json({ envoye: true });
}
