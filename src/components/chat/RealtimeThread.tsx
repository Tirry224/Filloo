"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * N'affiche rien : écoute les nouveaux messages de CE fil (migration
 * `0014_realtime_on_messages.sql`) et rafraîchit la page serveur dès qu'un
 * message arrive pendant qu'on lit le fil. Sans lui, un message reçu ne
 * s'affiche qu'au prochain aller-retour vers `/messages` — voir
 * docs/REPRISE.md, point 9.
 *
 * `router.refresh()` plutôt qu'un état local dupliqué : la page reste la
 * seule source qui sait lire un message (citation de produit, marquage
 * "lu"), donc c'est elle qui refait le travail, pas ce composant.
 *
 * Mes propres messages sont ignorés : `sendMessageAction` redirige déjà
 * vers ce fil, donc ils sont à l'écran avant que l'événement n'arrive.
 * Rafraîchir une seconde fois coûterait un aller-retour réseau pour
 * réafficher exactement la même page — sur un forfait de données guinéen,
 * ça se paie (docs/PERFORMANCE.md).
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
