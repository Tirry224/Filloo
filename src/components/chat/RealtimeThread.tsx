"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRealtimeClient } from "@/lib/supabase/client";
import { markThreadReadAction } from "@/lib/actions/messages";

/**
 * N'affiche rien : marque le fil comme lu à l'ouverture, puis écoute les
 * nouveaux messages de CE fil (migration `0014_realtime_on_messages.sql`),
 * les marque lus à leur tour et rafraîchit la page serveur.
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

  useEffect(() => {
    let stopped = false;
    let cleanup = () => {};
    createRealtimeClient().then((supabase) => {
      if (stopped) return;
      const channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            if (payload.new.sender_id === myParticipantId) return;
            // L'action rend déjà la page à nouveau quand elle a marqué
            // quelque chose ; rafraîchir en plus ferait deux allers-retours.
            void markThreadReadAction(conversationId).then((marque) => {
              if (!marque) router.refresh();
            });
          },
        )
        .subscribe();
      cleanup = () => supabase.removeChannel(channel);
    });

    return () => {
      stopped = true;
      cleanup();
    };
  }, [conversationId, myParticipantId, router]);

  return null;
}
