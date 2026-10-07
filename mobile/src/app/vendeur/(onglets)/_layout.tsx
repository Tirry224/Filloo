import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";
import { useCommercant } from "../../../lib/contexte-commercant";
import { couleurs } from "../../../theme";

/** La barre d'onglets du commerçant : mêmes quatre entrées que `MerchantNav` du site. */
export default function OngletsCommercant() {
  const { compte } = useCommercant();

  // Compte commerçant sans boutique : l'inscription n'est pas finie.
  if (!compte.boutique) return <Redirect href="/vendeur/creer-boutique" />;

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
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size} />,
        }}
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
