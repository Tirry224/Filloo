import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EtatVide } from "../../composants/EtatVide";
import { LigneFil } from "../../composants/LigneFil";
import { listerMesFils, type ResumeFil } from "../../lib/messages";
import { useComptes } from "../../lib/profil";
import { couleurs } from "../../theme";

/** Mes conversations de client. Rechargées à chaque retour sur l'onglet : un fil lu doit perdre son badge. */
export default function Messages() {
  const { session, client, pret, erreur: erreurCompte } = useComptes();
  const [fils, setFils] = useState<ResumeFil[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(async () => {
    if (!client) return;
    setErreur(false);
    try {
      setFils(await listerMesFils(client.id));
    } catch {
      setErreur(true);
    }
  }, [client]);

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

  let contenu;
  if (!pret) {
    contenu = <ActivityIndicator style={{ marginTop: 48 }} color={couleurs.accent} />;
  } else if (!session) {
    contenu = (
      <EtatVide
        icone="chatbubbles-outline"
        titre="Vos conversations"
        texte="Connectez-vous pour écrire aux vendeurs et retrouver vos échanges."
        action={{ libelle: "Se connecter", onPress: () => router.push("/connexion") }}
        actionSecondaire={{ libelle: "Créer un compte", onPress: () => router.push("/inscription") }}
      />
    );
  } else if (erreurCompte || erreur) {
    contenu = (
      <EtatVide
        icone="cloud-offline-outline"
        titre="Impossible de charger vos conversations"
        texte="Vérifiez votre connexion internet, puis réessayez."
        action={{ libelle: "Réessayer", onPress: rafraichir }}
      />
    );
  } else if (!client) {
    contenu = (
      <EtatVide
        icone="storefront-outline"
        titre="Messagerie de boutique bientôt dans l'app"
        texte="Votre connexion n'a qu'un compte commerçant. Ses conversations arriveront avec l'espace commerçant ; en attendant, utilisez le site."
      />
    );
  } else if (fils === null) {
    contenu = <ActivityIndicator style={{ marginTop: 48 }} color={couleurs.accent} />;
  } else {
    contenu = (
      <FlatList
        data={fils}
        keyExtractor={(f) => f.id}
        refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={couleurs.accent} />}
        ListEmptyComponent={
          <EtatVide
            icone="chatbubbles-outline"
            titre="Aucune conversation"
            texte="Depuis la fiche d'un produit, touchez « Contacter le vendeur » pour lui écrire."
          />
        }
        renderItem={({ item }) => <LigneFil fil={item} base="/messages" />}
      />
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <Text style={styles.titre}>Messages</Text>
      {contenu}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  titre: { fontSize: 28, fontWeight: "800", color: couleurs.ink, paddingHorizontal: 16, paddingVertical: 10 },
});
