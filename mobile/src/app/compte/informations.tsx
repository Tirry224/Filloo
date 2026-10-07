import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FeuilleChoix } from "../../composants/FeuilleChoix";
import { Champ, styles as champs } from "../../composants/FormulaireBoutique";
import { lireVilles, type Option } from "../../lib/catalogue";
import { enregistrerInformations, lienSuppression, lireInformations, type Informations } from "../../lib/compte";
import { formatTelephone } from "../../lib/format";
import { useSession } from "../../lib/session";
import { couleurs } from "../../theme";

/** Mes informations (`/compte/informations` du site), communes aux deux espaces. */
export default function MesInformations() {
  const { session } = useSession();
  const [infos, setInfos] = useState<Informations | null>(null);
  const [villes, setVilles] = useState<Option[]>([]);
  const [choixVille, setChoixVille] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!session) return;
    lireVilles().then(setVilles).catch(() => {});
    lireInformations(session.user.id)
      .then((i) => setInfos(i ? { ...i, telephone: formatTelephone(i.telephone) } : null))
      .catch(() => setErreur("Impossible de charger vos informations. Vérifiez votre connexion, puis réessayez."));
  }, [session]);

  async function enregistrer() {
    if (!session?.user.email || !infos) return;
    setEnvoi(true);
    setErreur(null);
    const refus = await enregistrerInformations({ authUserId: session.user.id, email: session.user.email, motDePasse, ...infos });
    setEnvoi(false);
    if (refus) setErreur(refus);
    else router.back();
  }

  const ville = villes.find((v) => v.id === infos?.villeId)?.name;

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <View style={styles.barre}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Fermer" hitSlop={8}>
          <Ionicons name="close" size={26} color={couleurs.ink} />
        </Pressable>
        <Text style={styles.barreTitre}>Mes informations</Text>
      </View>

      {!infos ? (
        erreur ? (
          <Text style={[styles.erreur, { padding: 16 }]}>{erreur}</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 48 }} color={couleurs.accent} />
        )
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
            <Text style={styles.discret}>Email : {session?.user.email}</Text>
            <Champ libelle="Nom complet" value={infos.nom} onChangeText={(nom) => setInfos({ ...infos, nom })} autoComplete="name" />
            <Champ
              libelle="Téléphone"
              value={infos.telephone}
              onChangeText={(telephone) => setInfos({ ...infos, telephone })}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            {infos.aUnCompteClient ? (
              <>
                <Text style={champs.libelle}>
                  Ma ville <Text style={champs.aide}>(le catalogue s'ouvre sur elle)</Text>
                </Text>
                <Pressable style={[champs.champ, champs.selecteur]} onPress={() => setChoixVille(true)}>
                  <Text style={{ fontSize: 16, color: ville ? couleurs.ink : couleurs.inkSoft }}>{ville ?? "Non renseignée"}</Text>
                  <Ionicons name="chevron-down" size={18} color={couleurs.inkSoft} />
                </Pressable>
              </>
            ) : null}
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
            <Pressable style={styles.bouton} onPress={enregistrer} disabled={envoi}>
              {envoi ? <ActivityIndicator color={couleurs.onAccent} /> : <Text style={styles.boutonTexte}>Enregistrer</Text>}
            </Pressable>

            <Pressable style={styles.lienLigne} onPress={() => router.push("/compte/mot-de-passe")}>
              <Text style={styles.lien}>Changer mon mot de passe</Text>
            </Pressable>
            {lienSuppression ? (
              <Pressable style={styles.lienLigne} onPress={() => lienSuppression && Linking.openURL(lienSuppression)}>
                <Text style={[styles.lien, { color: couleurs.danger }]}>Supprimer mon compte</Text>
                <Text style={styles.discret}>Se fait sur le site, où il faudra vous reconnecter.</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <FeuilleChoix
        titre="Ma ville"
        visible={choixVille}
        choix={[{ libelle: "Non renseignée", valeur: null }, ...villes.map((v) => ({ libelle: v.name, valeur: v.id as number | null }))]}
        actuel={infos?.villeId ?? null}
        onChoisir={(villeId) => infos && setInfos({ ...infos, villeId })}
        onFermer={() => setChoixVille(false)}
      />
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
  discret: { fontSize: 13, color: couleurs.inkSoft },
  erreur: { fontSize: 14, color: couleurs.danger, marginTop: 8 },
  bouton: { backgroundColor: couleurs.accent, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  boutonTexte: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
  lienLigne: { paddingVertical: 12, gap: 2, alignItems: "center" },
  lien: { fontSize: 15, fontWeight: "600", color: couleurs.accent },
});
