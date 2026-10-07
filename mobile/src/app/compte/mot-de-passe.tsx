import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Champ } from "../../composants/FormulaireBoutique";
import { changerMotDePasse } from "../../lib/compte";
import { useSession } from "../../lib/session";
import { couleurs } from "../../theme";

/** Changer son mot de passe en connaissant l'actuel (`changeMyPasswordAction` du site). */
export default function ChangerMotDePasse() {
  const { session } = useSession();
  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  async function enregistrer() {
    if (!session?.user.email) return;
    setEnvoi(true);
    setErreur(null);
    const refus = await changerMotDePasse(session.user.email, actuel, nouveau, confirmation);
    setEnvoi(false);
    if (refus) setErreur(refus);
    else setFait(true);
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Fermer" hitSlop={8}>
          <Ionicons name="close" size={26} color={couleurs.ink} />
        </Pressable>
        <Text style={styles.barreTitre}>Changer mon mot de passe</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          {fait ? (
            <>
              <Text style={styles.succes}>Mot de passe changé. Utilisez-le à votre prochaine connexion.</Text>
              <Pressable style={styles.bouton} onPress={() => router.back()}>
                <Text style={styles.boutonTexte}>Terminé</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Champ libelle="Mot de passe actuel" value={actuel} onChangeText={setActuel} secureTextEntry autoComplete="current-password" />
              <Champ
                libelle="Nouveau mot de passe"
                value={nouveau}
                onChangeText={setNouveau}
                secureTextEntry
                autoComplete="new-password"
                placeholder="8 caractères minimum"
              />
              <Champ
                libelle="Confirmer le nouveau"
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry
                autoComplete="new-password"
              />
              {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
              <Pressable style={styles.bouton} onPress={enregistrer} disabled={envoi}>
                {envoi ? <ActivityIndicator color={couleurs.onAccent} /> : <Text style={styles.boutonTexte}>Changer le mot de passe</Text>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  barre: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.line,
  },
  barreTitre: { fontSize: 18, fontWeight: "700", color: couleurs.ink },
  contenu: { padding: 16, gap: 6 },
  succes: { fontSize: 15, fontWeight: "600", color: couleurs.success, lineHeight: 22 },
  erreur: { fontSize: 14, color: couleurs.danger, marginTop: 8 },
  bouton: { backgroundColor: couleurs.accent, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  boutonTexte: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
});
