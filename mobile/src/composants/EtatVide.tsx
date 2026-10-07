import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { couleurs } from "../theme";

type Action = { libelle: string; onPress: () => void };

/** Équivalent d'`EmptyState` du site : une icône, un titre, une explication, une ou deux actions. */
export function EtatVide({
  icone = "cube-outline",
  titre,
  texte,
  action,
  actionSecondaire,
}: {
  icone?: ComponentProps<typeof Ionicons>["name"];
  titre: string;
  texte: string;
  action?: Action;
  actionSecondaire?: Action;
}) {
  return (
    <View style={styles.vide}>
      <Ionicons name={icone} size={40} color={couleurs.inkSoft} />
      <Text style={styles.titre}>{titre}</Text>
      <Text style={styles.texte}>{texte}</Text>
      {action ? (
        <Pressable style={styles.bouton} onPress={action.onPress}>
          <Text style={styles.boutonTexte}>{action.libelle}</Text>
        </Pressable>
      ) : null}
      {actionSecondaire ? (
        <Pressable style={[styles.bouton, styles.secondaire]} onPress={actionSecondaire.onPress}>
          <Text style={styles.secondaireTexte}>{actionSecondaire.libelle}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  vide: { alignItems: "center", gap: 8, padding: 32 },
  titre: { fontSize: 18, fontWeight: "700", color: couleurs.ink, textAlign: "center" },
  texte: { fontSize: 14, color: couleurs.inkSoft, textAlign: "center", lineHeight: 20 },
  bouton: { backgroundColor: couleurs.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, marginTop: 8 },
  boutonTexte: { color: couleurs.onAccent, fontSize: 15, fontWeight: "700" },
  secondaire: { backgroundColor: couleurs.surface, borderWidth: 1, borderColor: couleurs.line, marginTop: 0 },
  secondaireTexte: { color: couleurs.ink, fontSize: 15, fontWeight: "600" },
});
