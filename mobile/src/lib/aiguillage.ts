import { router } from "expo-router";
import { useEffect } from "react";
import { lireProfilClient } from "./messages";
import { useSession } from "./session";
import { lireCompteCommercant, lireEspace } from "./vendeur";

/** La connexion déjà aiguillée : on ne décide qu'une fois par connexion, jamais à chaque retour sur l'accueil. */
let dejaAiguille: string | null = null;
let premierLancement = true;

/**
 * Où ouvrir l'app, comme `landingForSession` du site : un commerçant sans
 * compte client va dans son espace ; avec les deux comptes, l'app rouvre
 * sur le dernier espace quitté, mais seulement au lancement — après une
 * connexion, la personne reste là où elle allait (« contacter ce
 * vendeur »). Jamais vers une boutique suspendue : son catalogue reste
 * l'endroit où elle a le droit d'être.
 */
export function useAiguillage() {
  const { session, chargement } = useSession();

  useEffect(() => {
    if (chargement) return;
    const lancement = premierLancement;
    premierLancement = false;
    if (!session || dejaAiguille === session.user.id) return;
    dejaAiguille = session.user.id;

    Promise.all([lireCompteCommercant(session.user.id), lireProfilClient(session.user.id), lireEspace()])
      .then(([commercant, client, memo]) => {
        if (!commercant || commercant.suspendu) return;
        if (!client || (lancement && memo === "merchant")) router.replace("/vendeur");
      })
      .catch(() => {
        // Sans réponse, on reste sur le catalogue : ouvert à tous, il ne trompe personne.
      });
  }, [chargement, session]);
}
