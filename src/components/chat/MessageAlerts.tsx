"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { messagesBase } from "@/lib/espace";

const STYLES = {
  cadre: "fixed inset-x-0 top-0 z-20 flex justify-center px-gutter pt-snug",
  bandeau: "flex w-full max-w-app items-start gap-snug rounded-lg border border-accent bg-surface p-snug",
  icone: "mt-px shrink-0 text-accent",
  texte: "flex min-w-0 flex-1 flex-col gap-hair",
  titre: "truncate text-sm font-semibold text-ink",
  extrait: "truncate text-xs text-ink-soft",
  fermer: "shrink-0 text-ink-soft",
} as const;

type Alerte = { titre: string; extrait: string; href: string };

let audio: AudioContext | null = null;

/**
 * Appelé à chaque geste, pas une seule fois : Safari repasse le contexte en
 * « interrupted » (et non « suspended ») après un appel ou un passage en
 * arrière-plan, et seul un nouveau geste le relance. Le tampon muet joué
 * pendant le geste est ce qui déverrouille réellement la sortie sur iPhone ;
 * `resume()` seul n'y suffit pas toujours.
 */
function deverrouillerSon() {
  audio ??= new AudioContext();
  if (audio.state === "running") return;
  void audio.resume();
  const muet = audio.createBufferSource();
  muet.buffer = audio.createBuffer(1, 1, audio.sampleRate);
  muet.connect(audio.destination);
  muet.start();
}

function jouerSon() {
  if (!audio || audio.state !== "running") return;
  const debut = audio.currentTime;
  for (const [frequence, decalage] of [[880, 0], [1320, 0.14]] as const) {
    const oscillateur = audio.createOscillator();
    const volume = audio.createGain();
    oscillateur.frequency.value = frequence;
    volume.gain.setValueAtTime(0.0001, debut + decalage);
    volume.gain.exponentialRampToValueAtTime(0.25, debut + decalage + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, debut + decalage + 0.13);
    oscillateur.connect(volume).connect(audio.destination);
    oscillateur.start(debut + decalage);
    oscillateur.stop(debut + decalage + 0.14);
  }
  navigator.vibrate?.([120, 60, 120]);
}

/**
 * Son, bandeau et rafraîchissement du badge à chaque message reçu, sur tous
 * les écrans. Le temps réel applique la policy "messages: lecture par les
 * participants" : seuls les messages de MES fils arrivent.
 *
 * Un navigateur ne joue aucun son avant un premier geste sur la page.
 */
export function MessageAlerts() {
  const router = useRouter();
  const pathname = usePathname();
  const cheminRef = useRef(pathname);
  const [alerte, setAlerte] = useState<Alerte | null>(null);
  const [connecte, setConnecte] = useState(false);

  useEffect(() => {
    cheminRef.current = pathname;
    setConnecte(document.cookie.includes("-auth-token"));
  }, [pathname]);

  useEffect(() => {
    if (!alerte) return;
    const minuterie = setTimeout(() => setAlerte(null), 6000);
    return () => clearTimeout(minuterie);
  }, [alerte]);

  useEffect(() => {
    if (!connecte) return;

    let arrete = false;
    let nettoyer = () => {};
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const rafraichir = () => {
      clearTimeout(minuterie);
      minuterie = setTimeout(() => router.refresh(), 300);
    };

    /* Un toucher n'active la page qu'au RELÂCHEMENT (`pointerup`) : c'est la
       règle HTML, que Safari applique à la lettre et Chrome Android non.
       Écouter seulement `pointerdown` laissait l'iPhone muet. */
    const gestes = ["pointerdown", "pointerup", "keydown"] as const;
    const onGeste = () => deverrouillerSon();
    for (const geste of gestes) window.addEventListener(geste, onGeste);

    const onVisible = () => {
      if (document.visibilityState === "visible") rafraichir();
    };
    document.addEventListener("visibilitychange", onVisible);

    import("@/lib/supabase/client").then(async ({ createRealtimeClient }) => {
      const supabase = await createRealtimeClient();
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (arrete || !userId) return;

      const { data: profils } = await supabase.from("profiles").select("id").eq("auth_user_id", userId);
      const mesProfils = new Set((profils ?? []).map((p) => p.id));
      if (arrete) return;

      const canal = supabase
        .channel("messages:alertes")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
          const message = payload.new as { conversation_id: string; sender_id: string; body: string };
          if (mesProfils.has(message.sender_id)) return;

          jouerSon();
          const dansCeFil = (["client", "merchant"] as const).some(
            (espace) => cheminRef.current === `${messagesBase(espace)}/${message.conversation_id}`,
          );
          if (dansCeFil) return;
          rafraichir();

          const { data: fil } = await supabase
            .from("conversations")
            .select("client_id, merchants(shop_name), profiles!conversations_client_id_fkey(full_name)")
            .eq("id", message.conversation_id)
            .maybeSingle<{
              client_id: string;
              merchants: { shop_name: string } | null;
              profiles: { full_name: string } | null;
            }>();
          const jeSuisVendeur = fil?.client_id === message.sender_id;
          setAlerte({
            titre: (jeSuisVendeur ? fil?.profiles?.full_name : fil?.merchants?.shop_name) || "Nouveau message",
            extrait: message.body,
            href: `${messagesBase(jeSuisVendeur ? "merchant" : "client")}/${message.conversation_id}`,
          });
        })
        .subscribe();
      nettoyer = () => supabase.removeChannel(canal);
    });

    return () => {
      arrete = true;
      clearTimeout(minuterie);
      for (const geste of gestes) window.removeEventListener(geste, onGeste);
      document.removeEventListener("visibilitychange", onVisible);
      nettoyer();
    };
  }, [router, connecte]);

  if (!alerte) return null;

  return (
    <div className={STYLES.cadre} role="status" aria-live="polite">
      <div className={STYLES.bandeau}>
        <MessageCircle size={18} strokeWidth={2} aria-hidden className={STYLES.icone} />
        <Link href={alerte.href} className={STYLES.texte} onClick={() => setAlerte(null)}>
          <span className={STYLES.titre}>{alerte.titre}</span>
          <span className={STYLES.extrait}>{alerte.extrait}</span>
        </Link>
        <button type="button" onClick={() => setAlerte(null)} aria-label="Fermer" className={STYLES.fermer}>
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}
