"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Pas dans les types DOM de TypeScript : l'événement n'est pas standard. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CLE_REFUS = "makiti:installation-refusee";
const DELAI_APRES_REFUS = 14 * 24 * 60 * 60 * 1000; // 14 jours

/* `localStorage` peut lever (navigation privée, stockage bloqué) : dans ce
   cas on se comporte comme si rien n'était retenu, la carte reste un
   confort. */
function refusRecent(): boolean {
  try {
    const quand = Number(localStorage.getItem(CLE_REFUS));
    return Number.isFinite(quand) && Date.now() - quand < DELAI_APRES_REFUS;
  } catch {
    return false;
  }
}

function retenirRefus() {
  try {
    localStorage.setItem(CLE_REFUS, String(Date.now()));
  } catch {
  }
}

function dejaInstallee(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS ne connaît pas `display-mode` pour une app ajoutée à
    // l'écran d'accueil ; il expose ce drapeau à la place.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function estIphone(): boolean {
  const ua = navigator.userAgent;
  // Un iPad récent se présente comme un Mac : le tactile le trahit.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "iphone" | null>(null);
  const [evenement, setEvenement] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (dejaInstallee() || refusRecent()) return;

    const surInstallable = (e: Event) => {
      // Empêche la mini-barre de Chrome : c'est notre carte qui pose la
      // question, une seule fois.
      e.preventDefault();
      setEvenement(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    const surInstallee = () => setMode(null);

    window.addEventListener("beforeinstallprompt", surInstallable);
    window.addEventListener("appinstalled", surInstallee);
    if (estIphone()) setMode("iphone");

    return () => {
      window.removeEventListener("beforeinstallprompt", surInstallable);
      window.removeEventListener("appinstalled", surInstallee);
    };
  }, []);

  if (!mode) return null;

  const plusTard = () => {
    retenirRefus();
    setMode(null);
  };

  const installer = async () => {
    if (!evenement) return;
    await evenement.prompt();
    const { outcome } = await evenement.userChoice;
    // L'événement ne sert qu'une fois : on l'oublie dans les deux cas.
    setEvenement(null);
    if (outcome === "dismissed") retenirRefus();
    setMode(null);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3">
      <section
        role="dialog"
        aria-labelledby="installation-titre"
        className="mx-auto flex w-full max-w-app flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sheet"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Download size={20} strokeWidth={1.8} aria-hidden />
          </div>
          <h2 id="installation-titre" className="text-base font-bold">
            Installer Makiti sur votre téléphone ?
          </h2>
        </div>

        {mode === "android" ? (
          <p className="text-sm leading-normal text-ink-soft">
            Makiti s’ouvrira depuis votre écran d’accueil, comme une application. Rien à
            télécharger depuis un store, et presque aucune place prise.
          </p>
        ) : (
          <p className="text-sm leading-normal text-ink-soft">
            {/* Le bouton est nommé, jamais situé : Partager est en bas dans
                Safari sur iPhone, mais en haut sur iPad et dans Chrome. */}
            Touchez{" "}
            <span className="font-semibold text-ink">
              <Share size={15} strokeWidth={2} aria-hidden className="inline align-text-bottom" />{" "}
              Partager
            </span>
            , puis{" "}
            <span className="font-semibold text-ink">
              <SquarePlus size={15} strokeWidth={2} aria-hidden className="inline align-text-bottom" />{" "}
              Sur l’écran d’accueil
            </span>
            . C’est aussi la seule façon de recevoir les notifications sur iPhone.
          </p>
        )}

        <div className="flex gap-2.5">
          <Button size="sm" variant="secondary" onClick={plusTard}>
            {mode === "android" ? "Plus tard" : "Compris"}
          </Button>
          {mode === "android" ? (
            <Button size="sm" onClick={installer}>
              Installer
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
