import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { messageErreurAuth } from "../lib/erreurs-auth";
import { supabase } from "../lib/supabase";
import { couleurs } from "../theme";

export default function Connexion() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function seConnecter() {
    const adresse = email.trim();
    if (!adresse || !motDePasse) {
      setErreur("Email et mot de passe obligatoires.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    const { error } = await supabase.auth.signInWithPassword({ email: adresse, password: motDePasse });
    setEnvoi(false);
    if (error) {
      setErreur(messageErreurAuth(error.message));
      return;
    }
    /* Retour là d'où la personne venait : la connexion s'ouvre par-dessus
       un écran, elle ne le remplace pas. */
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.centre}>
        <View style={styles.carte}>
          <Text style={styles.marque}>Filloo</Text>
          <Text style={styles.accroche}>Trouvez des produits et des commerçants près de chez vous.</Text>

          <Text style={styles.libelle}>Email</Text>
          <TextInput
            style={styles.champ}
            value={email}
            onChangeText={setEmail}
            placeholder="Adresse e-mail"
            placeholderTextColor={couleurs.inkSoft}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <Text style={styles.libelle}>Mot de passe</Text>
          <TextInput
            style={styles.champ}
            value={motDePasse}
            onChangeText={setMotDePasse}
            placeholder="••••••••"
            placeholderTextColor={couleurs.inkSoft}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={seConnecter}
          />

          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

          <Pressable
            onPress={seConnecter}
            disabled={envoi}
            style={({ pressed }) => [styles.bouton, (pressed || envoi) && { opacity: 0.8 }]}
          >
            {envoi ? <ActivityIndicator color={couleurs.onAccent} /> : <Text style={styles.texteBouton}>Se connecter</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  centre: { flex: 1, justifyContent: "center", padding: 16 },
  carte: { backgroundColor: couleurs.surface, borderRadius: 16, padding: 24, gap: 8, borderWidth: 1, borderColor: couleurs.line },
  marque: { fontSize: 32, fontWeight: "800", color: couleurs.accent },
  accroche: { fontSize: 16, color: couleurs.inkSoft, marginBottom: 12 },
  libelle: { fontSize: 14, fontWeight: "600", color: couleurs.ink, marginTop: 8 },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: couleurs.ink,
  },
  erreur: { fontSize: 14, color: couleurs.danger, marginTop: 8 },
  bouton: { backgroundColor: couleurs.accent, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  texteBouton: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
});
