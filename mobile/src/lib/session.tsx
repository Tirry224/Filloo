import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";

type EtatSession = { session: Session | null; chargement: boolean };

const ContexteSession = createContext<EtatSession>({ session: null, chargement: true });

/**
 * Une seule écoute de la session pour toute l'app : chaque écran lit
 * `useSession()` au lieu de redemander à Supabase.
 */
export function FournisseurSession({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatSession>({ session: null, chargement: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEtat({ session: data.session, chargement: false }));
    const { data } = supabase.auth.onAuthStateChange((_evenement, session) =>
      setEtat({ session, chargement: false }),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  return <ContexteSession.Provider value={etat}>{children}</ContexteSession.Provider>;
}

export function useSession() {
  return useContext(ContexteSession);
}
