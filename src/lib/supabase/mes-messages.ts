import { createRealtimeClient } from "@/lib/supabase/client";

/**
 * Ce que la base diffuse pour un message de MES fils (migration `0038`) :
 * à l'envoi (`INSERT`, une diffusion par message) et quand un fil est lu
 * (`UPDATE`, une diffusion par fil, champs du message éventuellement
 * vides).
 */
export type EvenementMessage = {
  op: "INSERT" | "UPDATE";
  id: string | null;
  conversation_id: string;
  sender_id: string | null;
  product_id: string | null;
  body: string | null;
  created_at: string | null;
  read_at: string | null;
};

type Ecouteur = (evenement: EvenementMessage) => void;

const ecouteurs = new Set<Ecouteur>();
let ouverture: Promise<void> | null = null;
let fermer: (() => void) | null = null;
/* Change quand le dernier écouteur part : une ouverture encore en cours
   (elle attend la session) se sait alors périmée et n'ouvre rien. Sans
   lui, un changement de compte rapide laissait le canal de l'ANCIEN. */
let generation = 0;

/**
 * Un seul canal par navigateur, privé et à mon nom (`user:<auth.uid()>`) :
 * la base n'y envoie que les messages de mes fils, et le RLS de
 * `realtime.messages` refuse ce canal à tout autre compte. Remplace
 * l'écoute de la table `messages` entière (0014), dont le coût grandissait
 * avec chaque personne connectée.
 *
 * Les composants s'y abonnent tous ensemble : le client du navigateur est
 * unique, et deux canaux sur le même sujet s'y gêneraient.
 */
export function ecouterMesMessages(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  ouverture ??= ouvrir(generation);
  return () => {
    ecouteurs.delete(ecouteur);
    if (ecouteurs.size > 0) return;
    generation += 1;
    ouverture = null;
    fermer?.();
    fermer = null;
  };
}

async function ouvrir(gen: number) {
  const supabase = await createRealtimeClient();
  const { data } = await supabase.auth.getSession();
  const moi = data.session?.user.id;
  // Plus personne n'écoute depuis l'appel : ne rien ouvrir.
  if (gen !== generation) return;
  // Personne de connecté : rien à ouvrir, le prochain écouteur réessaiera.
  if (!moi) {
    ouverture = null;
    return;
  }
  const canal = supabase
    .channel(`user:${moi}`, { config: { private: true } })
    .on("broadcast", { event: "message" }, ({ payload }) => {
      for (const ecouteur of ecouteurs) ecouteur(payload as EvenementMessage);
    })
    .subscribe();
  fermer = () => void supabase.removeChannel(canal);
}
