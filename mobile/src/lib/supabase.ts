import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState } from "react-native";
import type { Database } from "./database.types";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL ou EXPO_PUBLIC_SUPABASE_ANON_KEY manquante : copier `.env.example` en `.env`.");
}

/**
 * Même base que le site : le RLS protège les deux de la même façon.
 *
 * La session vit dans AsyncStorage et non dans SecureStore : SecureStore
 * plafonne à 2 Ko par valeur, et une session Supabase les dépasse.
 * `detectSessionInUrl` est coupé : il n'y a pas de barre d'adresse.
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

/* Un téléphone met l'app en veille : le jeton n'est rafraîchi que tant
   qu'elle est au premier plan, sinon le minuteur tourne dans le vide. */
AppState.addEventListener("change", (etat) => {
  if (etat === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
