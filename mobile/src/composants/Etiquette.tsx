import { StyleSheet, Text } from "react-native";
import { couleurs } from "../theme";

/** Équivalent de `Badge` du site. */
export function Etiquette({ libelle, accent = false }: { libelle: string; accent?: boolean }) {
  return <Text style={[styles.etiquette, accent && styles.accent]}>{libelle}</Text>;
}

const styles = StyleSheet.create({
  etiquette: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    color: couleurs.ink,
    backgroundColor: couleurs.placeholder,
  },
  accent: { color: couleurs.accent, backgroundColor: couleurs.accentSoft },
});
