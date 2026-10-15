"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markThreadReadAction } from "@/lib/actions/messages";

/**
 * N'affiche rien : marque le fil comme lu à l'ouverture, puis écoute les
 * nouveaux messages de CE fil (canal privé de `0038`), les marque lus à
 * leur tour et rafraîchit la page serveur.
 */
export function RealtimeThread({
  conversationId,
  myParticipantId,
}: {
  conversationId: string;
  myParticipantId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    void markThreadReadAction(conversationId);
  }, [conversationId]);

  /* L'écoute est chargée APRÈS l'affichage du fil, comme dans
     `MessageAlerts` : le client Supabase (environ 65 Ko) ne retarde plus
     l'ouverture d'une discussion, et le même morceau sert aux deux. */
  useEffect(() => {
    let arrete = false;
    let nettoyer = () => {};
    void import("@/lib/supabase/mes-messages").then(({ ecouterMesMessages }) => {
      if (arrete) return;
      nettoyer = ecouterMesMessages((message) => {
        if (message.op !== "INSERT" || message.conversation_id !== conversationId) return;
        if (message.sender_id === myParticipantId) return;
        // L'action rend déjà la page à nouveau quand elle a marqué
        // quelque chose ; rafraîchir en plus ferait deux allers-retours.
        void markThreadReadAction(conversationId).then((marque) => {
          if (!marque) router.refresh();
        });
      });
    });
    return () => {
      arrete = true;
      nettoyer();
    };
  }, [conversationId, myParticipantId, router]);

  return null;
}
