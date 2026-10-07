import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useSession } from "./session";
import { supabase } from "./supabase";

/**
 * Les notifications du téléphone, « comme une vraie application »
 * (décision du 2026-10-07). Le serveur du site les envoie par Expo
 * (`src/lib/push.ts`) aux téléphones inscrits dans `expo_push_tokens`
 * (0035) ; ce fichier inscrit le téléphone et ouvre la bonne conversation
 * quand on touche une notification.
 *
 * Expo Go ne reçoit plus les notifications sur Android : il faut une
 * version compilée de l'app (`eas build`) pour les essayer.
 */

/** Le jeton inscrit sur CE téléphone, pour pouvoir le retirer à la déconnexion. */
const CLE_JETON = "filloo.jeton-notification";

// App ouverte : la notification s'affiche quand même, avec son son.
if (Platform.OS !== "web") Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Demande l'autorisation, récupère le jeton Expo et l'inscrit au nom de
 * la personne connectée (`enregistrer_telephone`, qui reprend le jeton
 * s'il appartenait à un autre compte sur ce téléphone). Silencieux en cas
 * d'échec : l'app marche sans notifications.
 */
async function inscrireTelephone(): Promise<void> {
  if (!Device.isDevice) return; // un simulateur n'a pas de jeton
  try {
    if (Platform.OS === "android") {
      // Le canal que cite le serveur (`channelId: "messages"`) : importance haute = son et bandeau.
      await Notifications.setNotificationChannelAsync("messages", {
        name: "Messages",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#b64c1b",
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn("[notifications] projectId EAS absent : lancer `eas init` pour recevoir les notifications.");
      return;
    }
    const { data: jeton } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc("enregistrer_telephone", {
      p_token: jeton,
      p_plateforme: Platform.OS === "ios" ? "ios" : "android",
    });
    if (error) {
      console.error("[notifications] téléphone non inscrit :", error.message);
      return;
    }
    await AsyncStorage.setItem(CLE_JETON, jeton);
  } catch (e) {
    console.error("[notifications] inscription impossible :", e);
  }
}

/**
 * À appeler AVANT `signOut` : le téléphone cesse de sonner pour un compte
 * qui n'y est plus ouvert. Après la déconnexion, le RLS refuserait la
 * suppression. Si le réseau manque, la prochaine connexion sur ce
 * téléphone reprendra le jeton (`enregistrer_telephone`).
 */
export async function oublierTelephone(): Promise<void> {
  try {
    const jeton = await AsyncStorage.getItem(CLE_JETON);
    if (!jeton) return;
    await supabase.from("expo_push_tokens").delete().eq("token", jeton);
    await AsyncStorage.removeItem(CLE_JETON);
  } catch {
    // Best effort : la déconnexion ne doit jamais échouer pour ça.
  }
}

/** Se déconnecter proprement : retirer le téléphone, puis fermer la session. */
export async function deconnecter(): Promise<void> {
  await oublierTelephone();
  await supabase.auth.signOut();
}

/**
 * Les chemins que le serveur met dans une notification sont ceux du site ;
 * l'app a les mêmes pour les conversations. Tout autre chemin (ex. la
 * page de suspension, qui n'existe que sur le site) ouvre l'accueil.
 */
function ouvrir(url: unknown) {
  if (typeof url === "string" && /^\/(vendeur\/)?messages\/[0-9a-f-]{36}$/.test(url)) {
    router.push(url as `/messages/${string}`);
  } else {
    router.push("/");
  }
}

/** Monté une fois, à la racine : inscription à chaque connexion, ouverture au toucher. */
export function useNotifications() {
  const { session } = useSession();

  useEffect(() => {
    if (session && Platform.OS !== "web") inscrireTelephone();
  }, [session?.user.id]);

  useEffect(() => {
    // Hors téléphone (aperçu web), le module natif n'existe pas.
    if (Platform.OS === "web") return;
    // L'app ouverte PAR une notification (elle était fermée).
    // Au tour suivant : la navigation n'est pas encore montée pendant le premier rendu.
    const derniere = Notifications.getLastNotificationResponse();
    if (derniere) setTimeout(() => ouvrir(derniere.notification.request.content.data?.url), 0);
    // L'app déjà ouverte, ou en arrière-plan.
    const abonnement = Notifications.addNotificationResponseReceivedListener((reponse) =>
      ouvrir(reponse.notification.request.content.data?.url),
    );
    return () => abonnement.remove();
  }, []);
}
