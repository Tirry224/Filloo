import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ResumeFil } from "../lib/messages";
import { couleurs } from "../theme";

/** Une ligne de la liste des conversations, pour les deux espaces. */
export function LigneFil({ fil, base }: { fil: ResumeFil; base: "/messages" | "/vendeur/messages" }) {
  const nonLu = fil.nonLus > 0;
  const image = fil.produitPhotoUrl ?? fil.photoUrl;
  return (
    <Link href={`${base}/${fil.id}`} asChild>
      <Pressable style={styles.ligne}>
        {image ? (
          <Image source={image} style={styles.vignette} cachePolicy="disk" />
        ) : (
          <View style={[styles.vignette, styles.initiale]}>
            <Text style={styles.initialeTexte}>{fil.interlocuteur.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.haut}>
            <Text style={[styles.nom, nonLu && styles.gras]} numberOfLines={1}>
              {fil.interlocuteur}
            </Text>
            <Text style={[styles.quand, nonLu && { color: couleurs.accent }]}>{fil.dernierQuand}</Text>
          </View>
          {fil.produit ? (
            <Text style={styles.produit} numberOfLines={1}>
              {fil.produit}
            </Text>
          ) : null}
          <View style={styles.haut}>
            <Text style={[styles.apercu, nonLu && styles.apercuNonLu]} numberOfLines={1}>
              {fil.dernierMessage}
            </Text>
            {nonLu ? <Text style={styles.badge}>{fil.nonLus}</Text> : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.line,
  },
  vignette: { width: 52, height: 52, borderRadius: 10, backgroundColor: couleurs.placeholder },
  initiale: { alignItems: "center", justifyContent: "center", backgroundColor: couleurs.accentSoft },
  initialeTexte: { fontSize: 20, fontWeight: "700", color: couleurs.accent },
  haut: { flexDirection: "row", alignItems: "center", gap: 8 },
  nom: { flex: 1, fontSize: 16, fontWeight: "600", color: couleurs.ink },
  gras: { fontWeight: "800" },
  quand: { fontSize: 12, color: couleurs.inkSoft },
  produit: { fontSize: 12, color: couleurs.inkSoft },
  apercu: { flex: 1, fontSize: 14, color: couleurs.inkSoft },
  apercuNonLu: { color: couleurs.ink, fontWeight: "600" },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: couleurs.accent,
    color: couleurs.onAccent,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
