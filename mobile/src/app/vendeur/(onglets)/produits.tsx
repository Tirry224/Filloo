import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EtatVide } from "../../../composants/EtatVide";
import { LigneProduit } from "../../../composants/LigneProduit";
import type { Produit } from "../../../lib/catalogue";
import { useCommercant } from "../../../lib/contexte-commercant";
import { STATUT_FAIT, changerStatut, lireMesProduits, supprimerProduit } from "../../../lib/vendeur";
import { couleurs } from "../../../theme";

/** « Mes produits » : tous mes produits, et les gestes de la feuille d'actions du site. */
export default function MesProduits() {
  const { compte } = useCommercant();
  const boutique = compte.boutique!;
  const [produits, setProduits] = useState<Produit[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [rafraichit, setRafraichit] = useState(false);
  const [choisi, setChoisi] = useState<Produit | null>(null);
  const [avis, setAvis] = useState<{ texte: string; ok: boolean } | null>(null);

  const charger = useCallback(async () => {
    setErreur(false);
    try {
      setProduits(await lireMesProduits(boutique));
    } catch {
      setErreur(true);
    }
  }, [boutique]);

  // Rechargé à chaque retour sur l'onglet : un produit vient peut-être d'être créé ou modifié.
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

  async function agir(geste: () => Promise<string | null>, reussite: string) {
    setChoisi(null);
    const refus = await geste();
    setAvis(refus ? { texte: refus, ok: false } : { texte: reussite, ok: true });
    await charger();
  }

  function confirmerSuppression(p: Produit) {
    setChoisi(null);
    Alert.alert("Supprimer définitivement ?", `« ${p.titre} » disparaîtra. Vos conversations à son sujet sont conservées.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => agir(() => supprimerProduit(p.id), "Produit supprimé.") },
    ]);
  }

  const ajouter = () => router.push("/vendeur/produit/nouveau");

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <View style={styles.barre}>
        <Text style={styles.titre}>Mes produits</Text>
        <Pressable style={styles.ajouter} onPress={ajouter}>
          <Ionicons name="add" size={20} color={couleurs.accent} />
          <Text style={styles.ajouterTexte}>Ajouter</Text>
        </Pressable>
      </View>

      {avis ? (
        <Pressable onPress={() => setAvis(null)} style={[styles.avis, avis.ok ? styles.avisOk : styles.avisKo]}>
          <Text style={[styles.avisTexte, { color: avis.ok ? couleurs.success : couleurs.danger }]}>{avis.texte}</Text>
        </Pressable>
      ) : null}

      {erreur ? (
        <EtatVide
          icone="cloud-offline-outline"
          titre="Impossible de charger vos produits"
          texte="Vérifiez votre connexion internet, puis réessayez."
          action={{ libelle: "Réessayer", onPress: rafraichir }}
        />
      ) : produits === null ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={couleurs.accent} />
      ) : (
        <FlatList
          data={produits}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.liste}
          refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={couleurs.accent} />}
          renderItem={({ item }) => <LigneProduit produit={item} onPress={() => setChoisi(item)} />}
          ListEmptyComponent={
            <EtatVide
              icone="add-circle-outline"
              titre="Votre boutique est vide"
              texte="Un premier produit avec une photo nette et un prix clair suffit pour recevoir vos premiers messages."
              action={{ libelle: "Ajouter mon premier produit", onPress: ajouter }}
            />
          }
        />
      )}

      <Modal visible={choisi !== null} animationType="slide" transparent onRequestClose={() => setChoisi(null)}>
        <Pressable style={styles.voile} onPress={() => setChoisi(null)} />
        {choisi ? (
          <SafeAreaView style={styles.feuille} edges={["bottom"]}>
            <Text style={styles.feuilleTitre} numberOfLines={2}>
              {choisi.titre}
            </Text>
            {/* Ne proposer que ce que la base acceptera : `draft → sold` est refusé (0020). */}
            {choisi.statut === "draft" ? (
              <Action
                icone="eye-outline"
                libelle="Publier le produit"
                texte="Il entre dans le catalogue et devient visible de tous."
                onPress={() => agir(() => changerStatut(choisi.id, "active"), STATUT_FAIT.active)}
              />
            ) : null}
            {choisi.statut !== "sold" && choisi.statut !== "draft" ? (
              <Action
                icone="checkmark-circle-outline"
                libelle="Marquer comme vendu"
                texte="Le produit reste visible, barré, avec la mention « Vendu »."
                onPress={() => agir(() => changerStatut(choisi.id, "sold"), STATUT_FAIT.sold)}
              />
            ) : null}
            <Action
              icone="create-outline"
              libelle="Modifier le produit"
              texte="Titre, prix, photos, description."
              onPress={() => {
                const id = choisi.id;
                setChoisi(null);
                router.push(`/vendeur/produit/${id}`);
              }}
            />
            {choisi.statut === "draft" ? null : choisi.statut === "hidden" ? (
              <Action
                icone="eye-outline"
                libelle="Republier"
                texte="Le produit redevient visible dans le catalogue."
                onPress={() => agir(() => changerStatut(choisi.id, "active"), STATUT_FAIT.active)}
              />
            ) : (
              <Action
                icone="eye-off-outline"
                libelle="Masquer du catalogue"
                texte="Personne ne le voit plus, vous le republiez quand vous voulez."
                onPress={() => agir(() => changerStatut(choisi.id, "hidden"), STATUT_FAIT.hidden)}
              />
            )}
            <Action
              icone="trash-outline"
              libelle="Supprimer définitivement"
              texte="Vos conversations à son sujet sont conservées."
              danger
              onPress={() => confirmerSuppression(choisi)}
            />
          </SafeAreaView>
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

function Action({
  icone,
  libelle,
  texte,
  danger = false,
  onPress,
}: {
  icone: React.ComponentProps<typeof Ionicons>["name"];
  libelle: string;
  texte: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const couleur = danger ? couleurs.danger : couleurs.ink;
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Ionicons name={icone} size={22} color={couleur} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLibelle, { color: couleur }]}>{libelle}</Text>
        <Text style={styles.actionTexte}>{texte}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  barre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  titre: { fontSize: 28, fontWeight: "800", color: couleurs.ink },
  ajouter: { flexDirection: "row", alignItems: "center", gap: 4 },
  ajouterTexte: { fontSize: 16, fontWeight: "700", color: couleurs.accent },
  avis: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10 },
  avisOk: { backgroundColor: "#e3f5e9" },
  avisKo: { backgroundColor: couleurs.dangerSoft },
  avisTexte: { fontSize: 14, fontWeight: "600" },
  liste: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  voile: { flex: 1, backgroundColor: "rgba(39, 31, 24, 0.45)" },
  feuille: { backgroundColor: couleurs.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16 },
  feuilleTitre: { fontSize: 18, fontWeight: "700", color: couleurs.ink, paddingHorizontal: 16, paddingBottom: 8 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: couleurs.line,
  },
  actionLibelle: { fontSize: 16, fontWeight: "600" },
  actionTexte: { fontSize: 13, color: couleurs.inkSoft, marginTop: 2 },
});
