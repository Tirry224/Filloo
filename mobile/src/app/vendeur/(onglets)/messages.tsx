import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EtatVide } from "../../../composants/EtatVide";
import { LigneFil } from "../../../composants/LigneFil";
import { useCommercant } from "../../../lib/contexte-commercant";
import { listerFilsBoutique, type ResumeFil } from "../../../lib/messages";
import { couleurs } from "../../../theme";

/** Les conversations de ma boutique. Rechargées à chaque retour sur l'onglet. */
export default function MessagesCommercant() {
  const { compte } = useCommercant();
  const boutiqueId = compte.boutique!.id;
  const [fils, setFils] = useState<ResumeFil[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(async () => {
    setErreur(false);
    try {
      setFils(await listerFilsBoutique(boutiqueId, compte.profilId));
    } catch {
      setErreur(true);
    }
  }, [boutiqueId, compte.profilId]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  async function rafraichir() {
    setRafraichit(true);
    await charger();
    setRafraichit(false);
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <Text style={styles.titre}>Messages</Text>
      {erreur ? (
        <EtatVide
          icone="cloud-offline-outline"
          titre="Impossible de charger vos conversations"
          texte="Vérifiez votre connexion internet, puis réessayez."
          action={{ libelle: "Réessayer", onPress: rafraichir }}
        />
      ) : fils === null ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={couleurs.accent} />
      ) : (
        <FlatList
          data={fils}
          keyExtractor={(f) => f.id}
          refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={couleurs.accent} />}
          renderItem={({ item }) => <LigneFil fil={item} base="/vendeur/messages" />}
          ListEmptyComponent={
            <EtatVide
              icone="chatbubbles-outline"
              titre="Aucune demande pour l'instant"
              texte="Vos clients vous écriront depuis vos produits. Des photos nettes et des prix clairs les y aident."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  titre: { fontSize: 28, fontWeight: "800", color: couleurs.ink, paddingHorizontal: 16, paddingVertical: 10 },
});
