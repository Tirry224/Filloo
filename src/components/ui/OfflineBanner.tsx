"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Bandeau « Pas de connexion » — écran 4 de `docs/ECRANS.md`.
 *
 * POURQUOI CE COMPOSANT EST CLIENT, ALORS QUE PRESQUE AUCUN NE L'EST
 * Savoir si le téléphone a du réseau est une information que seul le
 * navigateur possède : aucun rendu serveur ne peut la deviner. C'est l'un
 * des rares cas où du JavaScript côté client est la seule solution, et non
 * la solution confortable. Il pèse quelques centaines d'octets et ne
 * s'affiche presque jamais — mais quand il s'affiche, il évite à quelqu'un
 * de croire que Makiti est cassé alors que c'est son réseau qui est tombé.
 * Sur les connexions que ce produit vise, la différence entre « l'app est
 * nulle » et « je n'ai plus de réseau » décide si la personne revient.
 *
 * CE QU'IL NE FAIT PAS, ET POURQUOI SON TEXTE NE PROMET RIEN
 * Il ne rend pas l'application consultable hors ligne : sans service
 * worker, une page non chargée reste inaccessible. La version d'origine de
 * ce bandeau disait « vous voyez les produits déjà consultés » — ce serait
 * un mensonge ici, puisque rien n'est mis en cache. Un message qui promet
 * ce que le produit ne tient pas coûte plus cher que pas de message.
 * Le vrai écran 4 — le fil rempli de ce qu'on a déjà consulté — viendra
 * avec le service worker (`docs/PERFORMANCE.md`, règle R6).
 *
 * LA LIMITE DE `navigator.onLine`
 * Il ment dans un cas : il dit « en ligne » quand le téléphone est
 * connecté à un réseau qui ne mène nulle part. Il détecte donc la coupure
 * franche, pas le réseau poussif. C'est déjà l'essentiel, et prétendre
 * mesurer le reste demanderait des requêtes de test — c'est-à-dire
 * consommer les données de quelqu'un qui n'en a déjà plus.
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
