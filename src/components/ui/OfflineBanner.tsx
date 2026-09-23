"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Composant CLIENT par nécessité : seul le navigateur sait si le téléphone
 * a du réseau.
 *
 * `navigator.onLine` voit la coupure franche, pas le réseau poussif — il
 * dit « en ligne » sur un réseau qui ne mène nulle part, et le mesurer
 * consommerait les données de quelqu'un qui n'en a plus.
 */
export function OfflineBanner() {
  const [horsLigne, setHorsLigne] = useState(false);

  useEffect(() => {
    const relever = () => setHorsLigne(!navigator.onLine);
    // Un premier relevé à la monture : l'onglet a pu rester en
    // arrière-plan sans qu'aucun événement `offline` ne passe.
    relever();
    window.addEventListener("online", relever);
    window.addEventListener("offline", relever);
    return () => {
      window.removeEventListener("online", relever);
      window.removeEventListener("offline", relever);
    };
  }, []);

  if (!horsLigne) return null;

  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 text-xs font-semibold text-warn-ink"
    >
      <WifiOff size={15} strokeWidth={2} aria-hidden />
      Pas de connexion — vérifiez votre réseau.
    </p>
  );
}
