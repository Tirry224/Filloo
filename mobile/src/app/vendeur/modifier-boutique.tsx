import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Champ, ChampsBoutique } from "../../composants/FormulaireBoutique";
import { useCommercant } from "../../lib/contexte-commercant";
import { envoyerPhotoBoutique, lireBoutiqueAEditer, modifierBoutique, type SaisieBoutique } from "../../lib/edition-boutique";
import { formatTelephone } from "../../lib/format";
import { useSession } from "../../lib/session";
import { couleurs } from "../../theme";

const urlStockage = process.env.EXPO_PUBLIC_SUPABASE_URL;

/** Modifier ma boutique (`/vendeur/boutique/modifier` du site), confirmé par le mot de passe actuel. */
export default function ModifierBoutique() {
  const { compte, recharger } = useCommercant();
  const { session } = useSession();
  const boutiqueId = compte.boutique!.id;
  const [saisie, setSaisie] = useState<SaisieBoutique | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    lireBoutiqueAEditer(boutiqueId)
      .then((b) => {
        if (!b) return;
        setSaisie({
          nom: b.shop_name,
          villeId: b.city_id,
          adresse: b.address_hint ?? "",
          whatsapp: b.whatsapp_phone ? formatTelephone(b.whatsapp_phone) : "",
          description: b.description ?? "",
        });
        setPhoto(b.photo_path);
        setApercu(b.photo_path ? `${urlStockage}/storage/v1/object/public/shop-photos/${b.photo_path}` : null);
      })
      .catch(() => setErreur("Impossible de charger votre boutique. Vérifiez votre connexion, puis réessayez."));
  }, [boutiqueId]);

  async function changerPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (r.canceled) return;
    const a = r.assets[0];
    setApercu(a.uri);
    setEnvoiPhoto(true);
    try {
      setPhoto(await envoyerPhotoBoutique({ uri: a.uri, largeur: a.width, hauteur: a.height, boutiqueId }));
    } catch {
      setErreur("La photo n'a pas pu être envoyée. Réessayez.");
      setApercu(null);
      setPhoto(null);
    } finally {
      setEnvoiPhoto(false);
    }
  }

  async function enregistrer() {
    if (!saisie || !session?.user.email) return;
    if (envoiPhoto) {
      setErreur("La photo est encore en cours d'envoi. Attendez qu'elle s'affiche, puis réessayez.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    const refus = await modifierBoutique({
      profilId: compte.profilId,
      boutiqueId,
      email: session.user.email,
      motDePasse,
      saisie,
      photo,
    });
    if (refus) {
      setEnvoi(false);
      setErreur(refus);
      return;
    }
    await recharger();
    setEnvoi(false);
    router.back();
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Fermer" hitSlop={8}>
          <Ionicons name="close" size={26} color={couleurs.ink} />
        </Pressable>
        <Text style={styles.barreTitre}>Modifier ma boutique</Text>
      </View>

      {saisie === null ? (
        erreur ? (
          <Text style={[styles.erreur, { padding: 16 }]}>{erreur}</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 48 }} color={couleurs.accent} />
        )
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
            <View style={styles.photoLigne}>
              <View style={styles.photo}>
                {apercu ? <Image source={apercu} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                {envoiPhoto ? (
                  <View style={styles.voile}>
                    <ActivityIndicator color={couleurs.onAccent} />
                  </View>
                ) : null}
              </View>
              <View style={{ gap: 8 }}>
                <Pressable onPress={changerPhoto}>
                  <Text style={styles.lien}>{apercu ? "Changer la photo" : "Ajouter une photo"}</Text>
                </Pressable>
                {apercu ? (
                  <Pressable
                    onPress={() => {
                      setApercu(null);
                      setPhoto(null);
                    }}
                  >
                    <Text style={[styles.lien, { color: couleurs.inkSoft }]}>Retirer la photo</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <ChampsBoutique saisie={saisie} onChange={setSaisie} />

            <Champ
              libelle="Mot de passe actuel"
              aide="pour confirmer"
              value={motDePasse}
              onChangeText={setMotDePasse}
              secureTextEntry
              autoComplete="current-password"
              placeholder="••••••••"
            />

            {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          </ScrollView>
          <View style={styles.pied}>
            <Pressable style={styles.bouton} onPress={enregistrer} disabled={envoi}>
              {envoi ? <ActivityIndicator color={couleurs.onAccent} /> : <Text style={styles.boutonTexte}>Enregistrer</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
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
  photoLigne: { flexDirection: "row", alignItems: "center", gap: 16 },
  photo: { width: 72, height: 72, borderRadius: 36, overflow: "hidden", backgroundColor: couleurs.placeholder },
  voile: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(39, 31, 24, 0.5)", alignItems: "center", justifyContent: "center" },
  lien: { fontSize: 15, fontWeight: "600", color: couleurs.accent },
  erreur: { fontSize: 14, color: couleurs.danger, marginTop: 8 },
  pied: { padding: 16, borderTopWidth: 1, borderTopColor: couleurs.line, backgroundColor: couleurs.surface },
  bouton: { backgroundColor: couleurs.accent, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  boutonTexte: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
});
