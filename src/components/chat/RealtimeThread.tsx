"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRealtimeClient } from "@/lib/supabase/client";

/**
 * N'affiche rien : écoute les nouveaux messages de CE fil (migration
 * `0014_realtime_on_messages.sql`) et rafraîchit la page serveur à leur
 * arrivée.
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
            router.refresh();
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
