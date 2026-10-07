import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useAiguillage } from "../../lib/aiguillage";
import { couleurs } from "../../theme";

/** La barre d'onglets du client. */
export default function Onglets() {
  useAiguillage();
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
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="recherche"
        options={{
          title: "Recherche",
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{
          title: "Compte",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
