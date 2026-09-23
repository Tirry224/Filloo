"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  abonnerInstallation,
  evenementInstallation,
  oublierEvenementInstallation,
} from "@/lib/installation";

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
  const evenement = useSyncExternalStore(abonnerInstallation, evenementInstallation, () => null);
  const [eligible, setEligible] = useState(false);
  const [iphone, setIphone] = useState(false);

  useEffect(() => {
    if (dejaInstallee() || refusRecent()) return;
    setEligible(true);
    setIphone(estIphone());
  }, []);

  const mode = !eligible ? null : evenement ? "android" : iphone ? "iphone" : null;
  if (!mode) return null;

  const plusTard = () => {
    retenirRefus();
    setEligible(false);
  };

  const installer = async () => {
    if (!evenement) return;
    await evenement.prompt();
    const { outcome } = await evenement.userChoice;
    oublierEvenementInstallation();
    if (outcome === "dismissed") retenirRefus();
    setEligible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3">
      <section
        role="dialog"
        aria-labelledby="installation-titre"
        className="mx-auto flex w-full max-w-app flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sheet sm:max-w-lecture"
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
