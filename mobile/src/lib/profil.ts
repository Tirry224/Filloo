import { useEffect, useState } from "react";
import { lireMaBoutiqueId, lireProfilClient, type ProfilClient } from "./messages";
import { useSession } from "./session";

/**
 * Le compte client et la boutique de la connexion. `pret` passe à `true`
 * une fois la réponse connue — y compris « pas connecté » — pour qu'un
 * écran ne dise pas « créez un compte » à quelqu'un dont le compte charge.
 */
export function useComptes() {
  const { session, chargement } = useSession();
  const [etat, setEtat] = useState<{ client: ProfilClient | null; boutiqueId: string | null; pret: boolean; erreur: boolean }>({
    client: null,
    boutiqueId: null,
    pret: false,
    erreur: false,
  });

  useEffect(() => {
    if (chargement) return;
    if (!session) {
      setEtat({ client: null, boutiqueId: null, pret: true, erreur: false });
      return;
    }
    setEtat((e) => ({ ...e, pret: false }));
    Promise.all([lireProfilClient(session.user.id), lireMaBoutiqueId(session.user.id)])
      .then(([client, boutiqueId]) => setEtat({ client, boutiqueId, pret: true, erreur: false }))
      .catch(() => setEtat({ client: null, boutiqueId: null, pret: true, erreur: true }));
  }, [chargement, session?.user.id]);

  return { session, ...etat };
}
