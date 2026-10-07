import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useNotifications } from "../lib/notifications";
import { FournisseurSession } from "../lib/session";
import { couleurs } from "../theme";

export default function Racine() {
  return (
    <FournisseurSession>
      <StatusBar style="dark" />
      <Notifications />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: couleurs.paper } }}>
        <Stack.Screen name="(onglets)" />
        <Stack.Screen name="produit/[id]" />
        <Stack.Screen name="boutique/[id]" />
        <Stack.Screen name="messages/[id]" />
        <Stack.Screen name="vendeur" />
        <Stack.Screen name="connexion" options={{ presentation: "modal" }} />
        <Stack.Screen name="inscription" options={{ presentation: "modal" }} />
        <Stack.Screen name="mot-de-passe-oublie" options={{ presentation: "modal" }} />
        <Stack.Screen name="compte/informations" options={{ presentation: "modal" }} />
        <Stack.Screen name="compte/mot-de-passe" options={{ presentation: "modal" }} />
      </Stack>
    </FournisseurSession>
  );
}

/** Sans rendu : inscrit le téléphone et ouvre la conversation d'une notification touchée. */
function Notifications() {
  useNotifications();
  return null;
}
