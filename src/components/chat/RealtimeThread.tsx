"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * N'affiche rien : écoute les nouveaux messages de CE fil (migration
 * `0014_realtime_on_messages.sql`) et rafraîchit la page serveur à leur
 * arrivée. Sans lui, un message reçu n'apparaît qu'au prochain
 * aller-retour vers `/messages`.
 *
 * `router.refresh()` plutôt qu'un état local dupliqué : la page reste la
 * seule à savoir rendre un message (citation de produit, marquage « lu »).
 *
 * Mes propres messages sont ignorés : `sendMessageAction` redirige déjà
 * vers ce fil, donc ils sont à l'écran avant l'événement, et rafraîchir
 * coûterait un aller-retour pour le même rendu (docs/PERFORMANCE.md).
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
    const supabase = createClient();
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, myParticipantId, router]);

  return null;
}
