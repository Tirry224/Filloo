"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ecouterMesMessages } from "@/lib/supabase/mes-messages";
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

  useEffect(
    () =>
      ecouterMesMessages((message) => {
        if (message.op !== "INSERT" || message.conversation_id !== conversationId) return;
        if (message.sender_id === myParticipantId) return;
        // L'action rend déjà la page à nouveau quand elle a marqué
        // quelque chose ; rafraîchir en plus ferait deux allers-retours.
        void markThreadReadAction(conversationId).then((marque) => {
          if (!marque) router.refresh();
        });
      }),
    [conversationId, myParticipantId, router],
  );

  return null;
}
