"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Bandeau « Pas de connexion » — écran 4 de `docs/ECRANS.md`.
 *
 * COMPOSANT CLIENT par nécessité, pas par confort : seul le navigateur
 * sait si le téléphone a du réseau. Quelques centaines d'octets pour
 * éviter qu'on croie Makiti cassé quand c'est le réseau qui est tombé.
 *
 * SON TEXTE NE PROMET RIEN : sans service worker, une page non chargée
 * reste inaccessible, et la version d'origine (« vous voyez les produits
 * déjà consultés ») mentait, rien n'étant mis en cache.
 *
 * `navigator.onLine` ment dans un cas : il dit « en ligne » sur un réseau
 * qui ne mène nulle part. Il voit la coupure franche, pas le réseau
 * poussif — le mesurer consommerait les données de quelqu'un qui n'en a
 * déjà plus.
 */
export function OfflineBanner() {
  const [horsLigne, setHorsLigne] = useState(false);

  useEffect(() => {
    const relever = () => setHorsLigne(!navigator.onLine);
    /* Un premier relevé à la monture : l'application peut très bien être
       ouverte depuis un onglet resté en arrière-plan, sans qu'aucun
       événement `offline` ne soit passé pendant ce temps. */
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
    /* `role="status"` et non `alert` : l'information est utile, pas
       urgente, et un lecteur d'écran ne doit pas interrompre la lecture en
       cours pour l'annoncer. */
    <p
      role="status"
      className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 text-xs font-semibold text-warn-ink"
    >
      <WifiOff size={15} strokeWidth={2} aria-hidden />
      Pas de connexion — vérifiez votre réseau.
    </p>
  );
}
