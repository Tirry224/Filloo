import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PRECISIONS_MAX } from "../lib/moderation";
import { couleurs } from "../theme";

/**
 * Le formulaire de signalement, pour un fil comme pour un produit : un
 * motif, des précisions facultatives. La personne signalée n'est pas
 * prévenue. Renvoie `{ ok, message }` : le message s'affiche dans les deux cas.
 */
export function FeuilleSignalement({
  visible,
  titre,
  motifs,
  onEnvoyer,
  onFermer,
}: {
  visible: boolean;
  titre: string;
  motifs: string[];
  onEnvoyer: (motif: string, precisions: string) => Promise<{ ok: boolean; message: string }>;
  onFermer: () => void;
}) {
  const [motif, setMotif] = useState(motifs[0]);
  const [precisions, setPrecisions] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMotif(motifs[0]);
    setPrecisions("");
    setRetour(null);
  }, [visible, motifs]);

  async function envoyer() {
    setEnvoi(true);
    setRetour(await onEnvoyer(motif, precisions));
    setEnvoi(false);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onFermer}>
      <Pressable style={styles.voile} onPress={onFermer} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={styles.feuille} edges={["bottom"]}>
          <Text style={styles.titre}>{titre}</Text>
          {retour?.ok ? (
            <View style={styles.corps}>
              <Text style={styles.merci}>{retour.message}</Text>
              <Pressable style={styles.bouton} onPress={onFermer}>
                <Text style={styles.boutonTexte}>Fermer</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.corps} keyboardShouldPersistTaps="handled">
              <Text style={styles.texte}>Votre signalement est envoyé à l'équipe Filloo. La personne n'est pas prévenue.</Text>
              {motifs.map((m) => (
                <Pressable key={m} style={styles.motif} onPress={() => setMotif(m)} accessibilityRole="radio" accessibilityState={{ selected: m === motif }}>
                  <Ionicons name={m === motif ? "radio-button-on" : "radio-button-off"} size={22} color={couleurs.accent} />
                  <Text style={styles.motifTexte}>{m}</Text>
                </Pressable>
              ))}
              <TextInput
                style={styles.champ}
                value={precisions}
                onChangeText={setPrecisions}
                placeholder="Précisez si besoin (facultatif)…"
                placeholderTextColor={couleurs.inkSoft}
                multiline
                maxLength={PRECISIONS_MAX}
              />
              {retour ? <Text style={styles.erreur}>{retour.message}</Text> : null}
              <Pressable style={[styles.bouton, styles.danger]} onPress={envoyer} disabled={envoi}>
                {envoi ? <ActivityIndicator color={couleurs.onAccent} /> : <Text style={styles.boutonTexte}>Envoyer le signalement</Text>}
              </Pressable>
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  voile: { flex: 1, backgroundColor: "rgba(39, 31, 24, 0.45)" },
  feuille: { maxHeight: "85%", backgroundColor: couleurs.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16 },
  titre: { fontSize: 18, fontWeight: "700", color: couleurs.ink, paddingHorizontal: 16 },
  corps: { padding: 16, gap: 4 },
  texte: { fontSize: 14, color: couleurs.inkSoft, lineHeight: 20, marginBottom: 8 },
  merci: { fontSize: 15, color: couleurs.success, fontWeight: "600", lineHeight: 22, marginBottom: 12 },
  motif: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: couleurs.line },
  motifTexte: { fontSize: 16, color: couleurs.ink },
  champ: {
    marginTop: 12,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: couleurs.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: couleurs.ink,
  },
  erreur: { fontSize: 14, color: couleurs.danger, marginTop: 8 },
  bouton: { backgroundColor: couleurs.accent, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  danger: { backgroundColor: couleurs.danger },
  boutonTexte: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
});
