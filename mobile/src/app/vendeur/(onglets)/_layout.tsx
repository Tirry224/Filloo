import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { EtatVide } from "../../../composants/EtatVide";
import { useCommercant } from "../../../lib/contexte-commercant";
import { couleurs } from "../../../theme";

/** La barre d'onglets du commerçant : mêmes quatre entrées que `MerchantNav` du site. */
export default function OngletsCommercant() {
  const { compte } = useCommercant();

  if (!compte.boutique) {
    return (
      <View style={{ flex: 1, backgroundColor: couleurs.paper, justifyContent: "center" }}>
        <EtatVide
          icone="storefront-outline"
          titre="Créez d'abord votre boutique"
          texte="Votre compte commerçant n'a pas encore de boutique. La création arrive bientôt dans l'app ; en attendant, faites-la sur le site."
        />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: couleurs.accent,
        tabBarInactiveTintColor: couleurs.inkSoft,
        tabBarStyle: { backgroundColor: couleurs.surface, borderTopColor: couleurs.line },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Accueil", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="produits"
        options={{ title: "Produits", tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="boutique"
        options={{
          title: "Boutique",
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
