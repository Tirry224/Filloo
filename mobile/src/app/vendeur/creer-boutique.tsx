import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChampsBoutique } from "../../composants/FormulaireBoutique";
import { useCommercant } from "../../lib/contexte-commercant";
import { creerBoutique, type SaisieBoutique } from "../../lib/edition-boutique";
import { couleurs } from "../../theme";

/**
 * Deuxième temps de l'inscription commerçant (`/inscription/boutique` du
 * site) : le compte existe, la boutique pas encore. Elle est en ligne dès
 * sa création (décision du 2026-10-02).
 */
export default function CreerBoutique() {
  const { compte, recharger } = useCommercant();
  const [saisie, setSaisie] = useState<SaisieBoutique>({ nom: "", villeId: null, adresse: "", whatsapp: "", description: "" });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function creer() {
    setEnvoi(true);
    setErreur(null);
    const refus = await creerBoutique(compte.profilId, saisie);
    if (refus) {
      setEnvoi(false);
      setErreur(refus);
      return;
    }
    await recharger();
    setEnvoi(false);
    router.replace("/vendeur");
  }

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={styles.titre}>Ma boutique</Text>
          <Text style={styles.texte}>Dernière étape : ce que vos clients verront de vous. Vous pourrez tout modifier ensuite.</Text>
          <ChampsBoutique saisie={saisie} onChange={setSaisie} creation />
          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          <Pressable style={styles.bouton} onPress={creer} disabled={envoi}>
            {envoi ? <ActivityIndicator color={couleurs.onAccent} /> : <Text style={styles.boutonTexte}>Créer ma boutique</Text>}
          </Pressable>
          <Pressable onPress={() => router.replace("/")} style={{ alignSelf: "center", padding: 8 }}>
            <Text style={styles.lien}>Plus tard, voir le catalogue</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  contenu: { padding: 16, gap: 6 },
  titre: { fontSize: 28, fontWeight: "800", color: couleurs.ink },
  texte: { fontSize: 15, lineHeight: 22, color: couleurs.inkSoft },
  erreur: { fontSize: 14, color: couleurs.danger, marginTop: 8 },
  bouton: { backgroundColor: couleurs.accent, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  boutonTexte: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
  lien: { fontSize: 14, fontWeight: "600", color: couleurs.inkSoft },
});
