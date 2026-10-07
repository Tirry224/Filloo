import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { couleurs } from "../theme";

export type Choix<T> = { libelle: string; valeur: T };

/** Une feuille qui monte du bas pour choisir une valeur dans une liste (ville, catégorie, tri). */
export function FeuilleChoix<T>({
  titre,
  visible,
  choix,
  actuel,
  onChoisir,
  onFermer,
}: {
  titre: string;
  visible: boolean;
  choix: Choix<T>[];
  actuel: T;
  onChoisir: (valeur: T) => void;
  onFermer: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onFermer}>
      <Pressable style={styles.voile} onPress={onFermer} accessibilityLabel="Fermer" />
      <SafeAreaView style={styles.feuille} edges={["bottom"]}>
        <Text style={styles.titre}>{titre}</Text>
        <ScrollView>
          {choix.map((c) => (
            <Pressable
              key={c.libelle}
              style={styles.choix}
              onPress={() => {
                onChoisir(c.valeur);
                onFermer();
              }}
            >
              <Text style={styles.texte}>{c.libelle}</Text>
              {c.valeur === actuel ? <Ionicons name="checkmark" size={20} color={couleurs.accent} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  voile: { flex: 1, backgroundColor: "rgba(39, 31, 24, 0.45)" },
  feuille: {
    maxHeight: "70%",
    backgroundColor: couleurs.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
  },
  titre: { fontSize: 18, fontWeight: "700", color: couleurs.ink, paddingHorizontal: 16, paddingBottom: 8 },
  choix: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: couleurs.line,
  },
  texte: { fontSize: 16, color: couleurs.ink },
});
