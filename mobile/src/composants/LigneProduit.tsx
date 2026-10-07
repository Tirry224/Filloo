import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Produit, Statut } from "../lib/catalogue";
import { formatGnf } from "../lib/format";
import { couleurs } from "../theme";

const LIBELLE: Record<Statut, string> = { active: "En ligne", sold: "Vendu", hidden: "Masqué", draft: "Brouillon" };

/** Une ligne de « Mes produits » : vignette, titre, prix, statut. */
export function LigneProduit({ produit, onPress }: { produit: Produit; onPress: () => void }) {
  const enLigne = produit.statut === "active";
  return (
    <Pressable style={styles.ligne} onPress={onPress}>
      {produit.photos[0] ? (
        <Image source={produit.photos[0]} style={styles.photo} cachePolicy="disk" />
      ) : (
        <View style={[styles.photo, styles.sansPhoto]}>
          <Ionicons name="image-outline" size={20} color={couleurs.inkSoft} />
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.titre} numberOfLines={1}>
          {produit.titre}
        </Text>
        <Text style={[styles.prix, produit.statut === "sold" && styles.barre]}>{formatGnf(produit.prixGnf)}</Text>
        <View style={styles.bas}>
          <Text style={[styles.statut, enLigne ? styles.statutEnLigne : styles.statutAutre]}>{LIBELLE[produit.statut]}</Text>
          {produit.contacts > 0 ? (
            <Text style={styles.contacts}>
              {produit.contacts} intéressé{produit.contacts > 1 ? "s" : ""}
            </Text>
          ) : null}
        </View>
      </View>
      <Ionicons name="ellipsis-horizontal" size={20} color={couleurs.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    backgroundColor: couleurs.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.line,
  },
  photo: { width: 64, height: 64, borderRadius: 8, backgroundColor: couleurs.placeholder },
  sansPhoto: { alignItems: "center", justifyContent: "center" },
  titre: { fontSize: 15, fontWeight: "600", color: couleurs.ink },
  prix: { fontSize: 15, fontWeight: "800", color: couleurs.ink },
  barre: { color: couleurs.inkSoft, textDecorationLine: "line-through" },
  bas: { flexDirection: "row", alignItems: "center", gap: 8 },
  statut: { fontSize: 12, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  statutEnLigne: { color: couleurs.success, backgroundColor: "#e3f5e9" },
  statutAutre: { color: couleurs.inkSoft, backgroundColor: couleurs.placeholder },
  contacts: { fontSize: 12, color: couleurs.inkSoft },
});
