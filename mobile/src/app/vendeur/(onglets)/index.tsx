import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Produit } from "../../../lib/catalogue";
import { useCommercant } from "../../../lib/contexte-commercant";
import { listerFilsBoutique } from "../../../lib/messages";
import { lireMesProduits } from "../../../lib/vendeur";
import { couleurs } from "../../../theme";

/** L'accueil commerçant : où en est la boutique aujourd'hui (page `/vendeur` du site). */
export default function AccueilCommercant() {
  const { compte } = useCommercant();
  const boutique = compte.boutique!;
  const [produits, setProduits] = useState<Produit[] | null>(null);
  const [nonLus, setNonLus] = useState<number | null>(null);
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(async () => {
    try {
      const [p, fils] = await Promise.all([lireMesProduits(boutique), listerFilsBoutique(boutique.id, compte.profilId)]);
      setProduits(p);
      setNonLus(fils.reduce((total, f) => total + f.nonLus, 0));
    } catch {
      setProduits(null);
      setNonLus(null);
    }
  }, [boutique, compte.profilId]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  const enLigne = produits?.filter((p) => p.statut === "active").length;
  const interesses = produits?.reduce((total, p) => total + p.contacts, 0);
  const brouillons = produits?.filter((p) => p.statut === "draft").length ?? 0;

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.contenu}
        refreshControl={
          <RefreshControl
            refreshing={rafraichit}
            onRefresh={async () => {
              setRafraichit(true);
              await charger();
              setRafraichit(false);
            }}
            tintColor={couleurs.accent}
          />
        }
      >
        <Text style={styles.marque}>Filloo</Text>
        <View style={{ gap: 2 }}>
          <Text style={styles.bonjour}>Bonjour, {boutique.nom}</Text>
          <Text style={styles.discret}>Voici où en est votre boutique aujourd'hui.</Text>
        </View>

        <Text style={styles.rubrique}>VOTRE ACTIVITÉ</Text>
        <View style={styles.tuiles}>
          <Pressable style={styles.tuile} onPress={() => router.push("/vendeur/produits")}>
            <Ionicons name="cube-outline" size={18} color={couleurs.inkSoft} />
            <Text style={styles.chiffre}>{enLigne ?? "–"}</Text>
            <Text style={styles.legende}>en ligne</Text>
          </Pressable>
          <Pressable style={[styles.tuile, styles.tuileAccent]} onPress={() => router.push("/vendeur/messages")}>
            <Ionicons name="chatbubble-outline" size={18} color={couleurs.accent} />
            <Text style={[styles.chiffre, { color: couleurs.accent }]}>{nonLus ?? "–"}</Text>
            <Text style={[styles.legende, { color: couleurs.accent }]}>non lu{nonLus === 1 ? "" : "s"}</Text>
          </Pressable>
          <View style={styles.tuile}>
            <Ionicons name="people-outline" size={18} color={couleurs.inkSoft} />
            <Text style={styles.chiffre}>{interesses ?? "–"}</Text>
            <Text style={styles.legende}>intéressé{interesses === 1 ? "" : "s"}</Text>
          </View>
        </View>

        {brouillons > 0 ? (
          <Pressable style={styles.rappel} onPress={() => router.push("/vendeur/produits")}>
            <Text style={styles.rappelTexte}>
              {brouillons} brouillon{brouillons > 1 ? "s" : ""} pas encore publié{brouillons > 1 ? "s" : ""}.
            </Text>
            <Text style={styles.rappelLien}>Voir</Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.bouton} onPress={() => router.push("/vendeur/produit/nouveau")}>
          <Ionicons name="add" size={20} color={couleurs.onAccent} />
          <Text style={styles.boutonTexte}>Ajouter un produit</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  contenu: { padding: 16, gap: 16 },
  marque: { fontSize: 24, fontWeight: "800", color: couleurs.accent },
  bonjour: { fontSize: 22, fontWeight: "800", color: couleurs.ink },
  discret: { fontSize: 14, color: couleurs.inkSoft },
  rubrique: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: couleurs.inkSoft },
  tuiles: { flexDirection: "row", gap: 10 },
  tuile: {
    flex: 1,
    gap: 2,
    padding: 12,
    backgroundColor: couleurs.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.line,
  },
  tuileAccent: { borderColor: couleurs.accent, backgroundColor: couleurs.accentSoft },
  chiffre: { fontSize: 26, fontWeight: "800", color: couleurs.ink },
  legende: { fontSize: 12, color: couleurs.inkSoft },
  rappel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: couleurs.accent,
    backgroundColor: couleurs.accentSoft,
  },
  rappelTexte: { flex: 1, fontSize: 14, color: couleurs.accent },
  rappelLien: { fontSize: 14, fontWeight: "700", color: couleurs.accent },
  bouton: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: couleurs.accent,
    borderRadius: 10,
    paddingVertical: 14,
  },
  boutonTexte: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
});
