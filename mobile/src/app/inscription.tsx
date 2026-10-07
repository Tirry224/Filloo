import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { messageErreurAuth } from "../lib/erreurs-auth";
import { nettoyer } from "../lib/messages";
import { supabase } from "../lib/supabase";
import { couleurs } from "../theme";

/** L'adresse du site : le lien de confirmation de l'email et les conditions s'y ouvrent. */
const SITE = process.env.EXPO_PUBLIC_SITE_URL;

const NOM_MIN = 2;
const NOM_MAX = 80;
const MOT_DE_PASSE_MIN = 8;

/** Un numéro guinéen sans indicatif : 9 chiffres commençant par 6 (règle de `telephone.ts` du site). */
const nettoyerTelephone = (v: string) => v.replace(/[\s.\-()]/g, "").replace(/^\+224/, "").replace(/^00224/, "");

/**
 * Inscription d'un CLIENT (le compte commerçant viendra avec l'espace
 * commerçant). Mêmes contrôles que `signUpAction` du site ; le profil est
 * créé par le trigger `handle_new_user` à partir des métadonnées.
 */
export default function Inscription() {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  function controler(): string | null {
    const n = [...nettoyer(nom)].length;
    if (!nettoyer(nom) || !telephone.trim() || !email.trim() || !motDePasse) return "Tous les champs sont obligatoires.";
    if (n < NOM_MIN) return `Nom complet : ${NOM_MIN} caractères visibles minimum.`;
    if (n > NOM_MAX) return `Nom complet : ${NOM_MAX} caractères maximum.`;
    if (!/^6\d{8}$/.test(nettoyerTelephone(telephone))) {
      return "Entrez un numéro guinéen à 9 chiffres commençant par 6 (exemple : 622 33 44 55).";
    }
    if (motDePasse.length < MOT_DE_PASSE_MIN) return `${MOT_DE_PASSE_MIN} caractères minimum pour le mot de passe.`;
    // Sans `trim` : pour Supabase, une espace de bord fait partie du mot de passe.
    if (motDePasse !== confirmation) return "Les deux mots de passe ne correspondent pas.";
    return null;
  }

  async function creer() {
    const refus = controler();
    if (refus) {
      setErreur(refus);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    const adresse = email.trim();
    const { data, error } = await supabase.auth.signUp({
      email: adresse,
      password: motDePasse,
      options: {
        data: { role: "client", full_name: nettoyer(nom), phone: nettoyerTelephone(telephone) },
        // Même lien que le site : la confirmation s'ouvre dans le navigateur.
        emailRedirectTo: SITE ? `${SITE}/auth/confirm?origine=inscription` : undefined,
      },
    });
    setEnvoi(false);
    if (error) {
      setErreur(messageErreurAuth(error.message));
      return;
    }
    // Pas de session tant que l'adresse n'est pas confirmée (réglage Supabase).
    if (!data.session) {
      setAConfirmer(adresse);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  if (aConfirmer) {
    return (
      <SafeAreaView style={[styles.page, { justifyContent: "center", padding: 16 }]}>
        <View style={styles.carte}>
          <Text style={styles.titre}>Vérifiez vos emails</Text>
          <Text style={styles.texte}>
            Compte créé. Ouvrez le lien envoyé à <Text style={{ fontWeight: "700" }}>{aConfirmer}</Text> pour confirmer
            votre adresse (pensez aux courriers indésirables), puis revenez ici pour vous connecter.
          </Text>
          <Pressable style={styles.bouton} onPress={() => router.replace("/connexion")}>
            <Text style={styles.boutonTexte}>Se connecter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <View style={styles.carte}>
            <Text style={styles.titre}>Créer un compte</Text>
            <Text style={styles.texte}>Pour écrire aux vendeurs et retrouver vos échanges.</Text>

            <Champ libelle="Nom complet" value={nom} onChangeText={setNom} placeholder="Prénom et nom" autoComplete="name" maxLength={NOM_MAX} />
            <Champ
              libelle="Téléphone"
              value={telephone}
              onChangeText={setTelephone}
              placeholder="622 33 44 55"
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <Champ
              libelle="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Adresse e-mail"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Champ
              libelle="Mot de passe"
              value={motDePasse}
              onChangeText={setMotDePasse}
              placeholder={`${MOT_DE_PASSE_MIN} caractères minimum`}
              secureTextEntry
              autoComplete="new-password"
            />
            <Champ
              libelle="Confirmer le mot de passe"
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder="Le même mot de passe"
              secureTextEntry
              autoComplete="new-password"
            />

            {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

            <Pressable style={[styles.bouton, envoi && { opacity: 0.8 }]} onPress={creer} disabled={envoi}>
              {envoi ? <ActivityIndicator color={couleurs.onAccent} /> : <Text style={styles.boutonTexte}>Créer mon compte</Text>}
            </Pressable>

            {/* L'article 25 des conditions fait reposer leur acceptation sur ce bouton. */}
            <Text style={styles.mentions}>
              En créant un compte, vous acceptez les{" "}
              <Text style={styles.lien} onPress={() => SITE && Linking.openURL(`${SITE}/conditions`)}>
                conditions d'utilisation
              </Text>{" "}
              et la{" "}
              <Text style={styles.lien} onPress={() => SITE && Linking.openURL(`${SITE}/confidentialite`)}>
                politique de confidentialité
              </Text>
              .
            </Text>

            <Text style={styles.mentions}>
              Déjà un compte ?{" "}
              <Text style={styles.lien} onPress={() => router.replace("/connexion")}>
                Se connecter
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Champ({ libelle, ...props }: { libelle: string } & TextInputProps) {
  return (
    <View style={{ gap: 6, marginTop: 8 }}>
      <Text style={styles.libelle}>{libelle}</Text>
      <TextInput style={styles.champ} placeholderTextColor={couleurs.inkSoft} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  contenu: { padding: 16, flexGrow: 1, justifyContent: "center" },
  carte: { backgroundColor: couleurs.surface, borderRadius: 16, padding: 24, gap: 8, borderWidth: 1, borderColor: couleurs.line },
  titre: { fontSize: 26, fontWeight: "800", color: couleurs.ink },
  texte: { fontSize: 15, lineHeight: 22, color: couleurs.inkSoft },
  libelle: { fontSize: 14, fontWeight: "600", color: couleurs.ink },
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
  boutonTexte: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
  mentions: { fontSize: 13, lineHeight: 19, color: couleurs.inkSoft, textAlign: "center", marginTop: 8 },
  lien: { color: couleurs.accent, fontWeight: "600" },
});
