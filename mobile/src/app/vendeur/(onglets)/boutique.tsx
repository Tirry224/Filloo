import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCommercant } from "../../../lib/contexte-commercant";
import { formatTelephone } from "../../../lib/format";
import { supabase } from "../../../lib/supabase";
import { retenirEspace } from "../../../lib/vendeur";
import { couleurs } from "../../../theme";

/** L'onglet Boutique : ce que les clients voient de moi, et les réglages du compte. */
export default function MaBoutique() {
  const { compte } = useCommercant();
  const boutique = compte.boutique!;

  async function versClient() {
    await retenirEspace("client");
    router.replace("/");
  }

  async function deconnecter() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.titre}>Ma boutique</Text>

        <View style={styles.identite}>
          {boutique.photoUrl ? (
            <Image source={boutique.photoUrl} style={styles.avatar} cachePolicy="disk" />
          ) : (
            <View style={[styles.avatar, styles.initiale]}>
              <Text style={styles.initialeTexte}>{boutique.nom.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.nom}>{boutique.nom}</Text>
            {boutique.description ? <Text style={styles.discret}>{boutique.description}</Text> : null}
          </View>
        </View>

        <View style={styles.carte}>
          <Ligne icone="location-outline" texte={`${boutique.adresse ? `${boutique.adresse} · ` : ""}${boutique.ville}`} />
          <Ligne icone="logo-whatsapp" texte={boutique.whatsapp ? formatTelephone(boutique.whatsapp) : "Pas de numéro WhatsApp"} />
        </View>

        <Pressable style={styles.entree} onPress={() => router.push(`/boutique/${boutique.id}`)}>
          <Ionicons name="eye-outline" size={20} color={couleurs.ink} />
          <Text style={styles.entreeTexte}>Voir ma boutique comme un client</Text>
          <Ionicons name="chevron-forward" size={18} color={couleurs.inkSoft} />
        </Pressable>
        <Pressable style={styles.entree} onPress={versClient}>
          <Ionicons name="swap-horizontal-outline" size={20} color={couleurs.ink} />
          <Text style={styles.entreeTexte}>Passer à l'espace client</Text>
          <Ionicons name="chevron-forward" size={18} color={couleurs.inkSoft} />
        </Pressable>
        <Pressable style={styles.entree} onPress={deconnecter}>
          <Ionicons name="log-out-outline" size={20} color={couleurs.danger} />
          <Text style={[styles.entreeTexte, { color: couleurs.danger }]}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Ligne({ icone, texte }: { icone: React.ComponentProps<typeof Ionicons>["name"]; texte: string }) {
  return (
    <View style={styles.ligne}>
      <Ionicons name={icone} size={17} color={couleurs.inkSoft} />
      <Text style={styles.ligneTexte}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  contenu: { padding: 16, gap: 14 },
  titre: { fontSize: 28, fontWeight: "800", color: couleurs.ink },
  identite: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: couleurs.placeholder },
  initiale: { alignItems: "center", justifyContent: "center", backgroundColor: couleurs.accentSoft },
  initialeTexte: { fontSize: 24, fontWeight: "700", color: couleurs.accent },
  nom: { fontSize: 20, fontWeight: "800", color: couleurs.ink },
  discret: { fontSize: 14, color: couleurs.inkSoft, lineHeight: 20 },
  carte: { gap: 10, padding: 14, backgroundColor: couleurs.surface, borderRadius: 12, borderWidth: 1, borderColor: couleurs.line },
  ligne: { flexDirection: "row", alignItems: "center", gap: 10 },
  ligneTexte: { flex: 1, fontSize: 14, color: couleurs.ink },
  entree: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: couleurs.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.line,
  },
  entreeTexte: { flex: 1, fontSize: 16, fontWeight: "600", color: couleurs.ink },
});
