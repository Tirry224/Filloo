"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Recalcule le badge et le tableau de bord quand un message arrive ou quand
 * l'application revient au premier plan. Next ne rend pas un layout partagé
 * entre deux onglets : sans ce rafraîchissement, le compteur reste figé.
 *
 * Aucun filtre ici : le temps réel applique la policy "messages: lecture par
 * les participants", donc seuls les messages de MES fils arrivent.
 */
export function RealtimeUnread() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    const supabase = createClient();
    const channel = supabase
      .channel("messages:non-lus")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
