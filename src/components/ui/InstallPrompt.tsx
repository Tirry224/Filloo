"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Propose, à l'entrée dans l'application, de l'installer sur le téléphone.
 *
 * « Installer » et non « télécharger » : Makiti n'est pas sur un store. Le
 * navigateur l'ajoute à l'écran d'accueil grâce au manifeste
 * (`src/app/manifest.ts`) ; elle s'ouvre ensuite en plein écran, et sur
 * iPhone c'est la SEULE façon de recevoir les notifications.
 *
 * DEUX CHEMINS, parce que les navigateurs ne se ressemblent pas :
 *   - Android (Chrome, Edge, Samsung) émet `beforeinstallprompt` quand
 *     l'application est installable. On le retient et on ne montre la
 *     question QUE s'il arrive : sans lui, le bouton « Installer » ne
 *     ferait rien.
 *   - iPhone n'a aucune API d'installation. On ne peut qu'expliquer le
 *     geste : Partager, puis « Sur l'écran d'accueil ».
 * Ailleurs (Firefox, ordinateur sans l'événement), rien ne s'affiche :
 * une question à laquelle on ne peut pas donner suite est une nuisance.
 *
 * UN « PLUS TARD » EST RESPECTÉ. La réponse est gardée dans
 * `localStorage` et la question ne revient pas avant `DELAI_APRES_REFUS`.
 * La redemander à chaque visite apprendrait surtout à la fermer sans lire.
 *
 * OÙ ELLE VIT : dans les deux layouts `(onglets)`, pas à la racine. Ce
 * sont les écrans par lesquels on entre (accueil, recherche, boutique, et
 * leurs pendants vendeur). À la racine, sa référence client alourdissait
 * CHAQUE page, et `/conditions`, déjà au plafond, sortait du budget de
 * `npm run poids`. Une fiche produit ouverte depuis WhatsApp ne la montre
 * pas non plus : ce n'est pas le moment d'interrompre.
 *
 * Aucun voile sur l'écran : la personne voit ce qu'elle est venue voir et
 * peut ignorer la carte. Bloquer l'entrée pour poser une question serait
 * faire passer notre intérêt avant le sien.
 */

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
    // Sans stockage, la question reviendra à la prochaine visite. Tant pis.
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
            Touchez{" "}
            <Share size={15} strokeWidth={2} aria-label="Partager" className="inline align-text-bottom" />{" "}
            en bas de l’écran, puis{" "}
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
