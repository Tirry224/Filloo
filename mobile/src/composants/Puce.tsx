import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { couleurs } from "../theme";

/** Équivalent de `Chip` du site : un filtre qu'on touche. */
export function Puce({
  libelle,
  active = false,
  icone,
  onPress,
}: {
  libelle: string;
  active?: boolean;
  icone?: ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.puce, active && styles.active]}
    >
      {icone ? <Ionicons name={icone} size={15} color={active ? couleurs.onAccent : couleurs.ink} /> : null}
      <Text style={[styles.texte, active && styles.texteActif]}>{libelle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  puce: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: couleurs.line,
    backgroundColor: couleurs.surface,
  },
  active: { backgroundColor: couleurs.ink, borderColor: couleurs.ink },
  texte: { fontSize: 14, fontWeight: "600", color: couleurs.ink },
  texteActif: { color: couleurs.onAccent },
});
