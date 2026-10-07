import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { FournisseurSession } from "../lib/session";
import { couleurs } from "../theme";

export default function Racine() {
  return (
    <FournisseurSession>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: couleurs.paper } }}>
        <Stack.Screen name="(onglets)" />
        <Stack.Screen name="produit/[id]" />
        <Stack.Screen name="boutique/[id]" />
        <Stack.Screen name="messages/[id]" />
        <Stack.Screen name="connexion" options={{ presentation: "modal" }} />
        <Stack.Screen name="inscription" options={{ presentation: "modal" }} />
      </Stack>
    </FournisseurSession>
  );
}
