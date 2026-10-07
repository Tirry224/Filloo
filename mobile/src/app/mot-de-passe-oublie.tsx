import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { demanderReinitialisation } from "../lib/compte";
import { couleurs } from "../theme";

/** Mot de passe oublié : l'email contient un lien qui s'ouvre sur le site, où l'on choisit le nouveau. */
export default function MotDePasseOublie() {
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  async function envoyer() {
    if (!email.trim()) return;
    setEnvoi(true);
    await demanderReinitialisation(email);
    setEnvoi(false);
    setEnvoye(true);
  }

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.centre}>
        <View style={styles.carte}>
          <Text style={styles.titre}>Mot de passe oublié</Text>
          {envoye ? (
            <>
              {/* Même texte que l'adresse existe ou non : il ne doit pas révéler qui a un compte. */}
              <Text style={styles.texte}>
                Si un compte existe avec cette adresse, un email vient de partir. Ouvrez le lien qu'il contient pour choisir un
                nouveau mot de passe (pensez aux courriers indésirables), puis revenez ici vous connecter.
              </Text>
              <Pressable style={styles.bouton} onPress={() => router.replace("/connexion")}>
                <Text style={styles.boutonTexte}>Se connecter</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.texte}>Entrez l'adresse de votre compte : nous vous envoyons un lien pour en choisir un nouveau.</Text>
              <TextInput
                style={styles.champ}
                value={email}
                onChangeText={setEmail}
                placeholder="Adresse e-mail"
                placeholderTextColor={couleurs.inkSoft}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                onSubmitEditing={envoyer}
              />
              <Pressable style={styles.bouton} onPress={envoyer} disabled={envoi}>
                {envoi ? <ActivityIndicator color={couleurs.onAccent} /> : <Text style={styles.boutonTexte}>Envoyer le lien</Text>}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  centre: { flex: 1, justifyContent: "center", padding: 16 },
  carte: { backgroundColor: couleurs.surface, borderRadius: 16, padding: 24, gap: 12, borderWidth: 1, borderColor: couleurs.line },
  titre: { fontSize: 24, fontWeight: "800", color: couleurs.ink },
  texte: { fontSize: 15, lineHeight: 22, color: couleurs.inkSoft },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: couleurs.ink,
  },
  bouton: { backgroundColor: couleurs.accent, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  boutonTexte: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
});
