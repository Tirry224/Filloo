import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "../lib/session";
import { couleurs } from "../theme";

/** L'aiguillage au lancement : connecté ou non. */
export default function Aiguillage() {
  const { session, chargement } = useSession();

  if (chargement) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }
  return <Redirect href={session ? "/accueil" : "/connexion"} />;
}
