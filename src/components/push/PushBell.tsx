"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { usePushAbonnement } from "@/components/push/usePushAbonnement";
import { cn } from "@/lib/cn";

/**
 * Cloche de l'en-tête : un tap active les notifications sur cet appareil,
 * un second les coupe — sans passer par « Mon compte » (décision du
 * 2026-10-22) ; c'est le seul réglage des notifications du site depuis
 * le 2026-10-23. Trois cas : non supporté, bloqué par le navigateur,
 * abonné ou non. Les deux
 * premiers ne peuvent rien basculer : le tap ouvre alors une bulle qui
 * dit quoi faire, sinon la cloche paraîtrait cassée.
 */
export function PushBell({ connecte }: { connecte: boolean }) {
  /* Sans session, l'abonnement n'a personne à qui se rattacher
     (`savePushSubscriptionAction` le refuse) : la cloche mène à la
     connexion, et le hook n'est pas monté du tout. */
  if (!connecte) {
    return (
      <Link
        href="/connexion?next=/"
        aria-label="Se connecter pour recevoir les notifications"
        className={classes.bouton}
      >
        <Bell size={21} strokeWidth={1.9} aria-hidden />
      </Link>
    );
  }
  return <ClocheConnectee />;
}

const DUREE_BULLE_MS = 4_000;

const BULLE_NON_SUPPORTE =
  "Notifications impossibles ici. Sur iPhone : Partager, puis « Sur l'écran d'accueil ».";
const BULLE_BLOQUE =
  "Notifications bloquées. Réautorisez-les dans les réglages du navigateur.";

const classes = {
  bouton: "-m-2 flex size-tap items-center justify-center rounded-full text-ink-soft",
  actif: "text-accent",
  bulle:
    "absolute top-full right-0 z-20 mt-2 w-64 rounded-lg border border-line bg-surface p-3 text-sm",
};

function ClocheConnectee() {
  const { supporte, permission, abonne, enCours, erreur, message, activer, desactiver } = usePushAbonnement({ auto: true });
  const [bulle, setBulle] = useState<string | null>(null);

  // Le résultat d'un geste (activé, désactivé, échec) passe par la bulle.
  useEffect(() => {
    if (erreur || message) setBulle(erreur ?? message);
  }, [erreur, message]);

  useEffect(() => {
    if (!bulle) return;
    const minuteur = setTimeout(() => setBulle(null), DUREE_BULLE_MS);
    return () => clearTimeout(minuteur);
  }, [bulle]);

  const bloque = supporte === false || permission === "denied";

  const auTap = () => {
    if (supporte === false) return setBulle(BULLE_NON_SUPPORTE);
    if (permission === "denied") return setBulle(BULLE_BLOQUE);
    void (abonne ? desactiver() : activer());
  };

  const Icone = abonne ? BellRing : bloque ? BellOff : Bell;
  const libelle = abonne ? "Désactiver les notifications" : "Activer les notifications";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={auTap}
        // `supporte === null` : vérification en cours, rien à basculer encore.
        disabled={enCours || supporte === null}
        aria-label={libelle}
        aria-pressed={abonne}
        className={cn(classes.bouton, abonne && classes.actif)}
      >
        <Icone size={21} strokeWidth={1.9} aria-hidden />
      </button>
      {bulle ? (
        <p role="status" className={cn(classes.bulle, erreur || bloque ? "text-danger" : "text-ink")}>
          {bulle}
        </p>
      ) : null}
    </div>
  );
}
