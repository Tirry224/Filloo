import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EtatVide } from "../../composants/EtatVide";
import { GrilleProduits } from "../../composants/GrilleProduits";
import { lireBoutique, lireProduitsBoutique, type FicheBoutique, type Produit } from "../../lib/catalogue";
import { couleurs } from "../../theme";

/** La page publique d'une boutique (écran 11 de SPEC) : qui elle est, où, et ce qu'elle vend. */
export default function Boutique() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [boutique, setBoutique] = useState<FicheBoutique | null | undefined>(undefined);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [erreur, setErreur] = useState(false);
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(async () => {
    setErreur(false);
    try {
      const b = await lireBoutique(id);
      setBoutique(b);
      setProduits(b ? await lireProduitsBoutique(b) : []);
    } catch {
      setErreur(true);
    }
  }, [id]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function rafraichir() {
    setRafraichit(true);
    await charger();
    setRafraichit(false);
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <View style={styles.barre}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityLabel="Retour"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={couleurs.ink} />
        </Pressable>
        <Text style={styles.barreTitre} numberOfLines={1}>
          {boutique?.nom ?? ""}
        </Text>
      </View>

      {erreur ? (
        <EtatVide
          icone="cloud-offline-outline"
          titre="Impossible de charger cette boutique"
          texte="Vérifiez votre connexion internet, puis réessayez."
          action={{ libelle: "Réessayer", onPress: charger }}
        />
      ) : boutique === undefined ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={couleurs.accent} />
      ) : boutique === null ? (
        <EtatVide icone="storefront-outline" titre="Cette boutique n'existe plus" texte="Elle a été fermée ou n'est plus en ligne." />
      ) : (
        <GrilleProduits
          produits={produits}
          rafraichit={rafraichit}
          onRafraichir={rafraichir}
          entete={
            <View style={styles.entete}>
              <View style={styles.identite}>
                {boutique.photoUrl ? (
                  <Image source={boutique.photoUrl} style={styles.avatar} cachePolicy="disk" />
                ) : (
                  <View style={[styles.avatar, styles.initiale]}>
                    <Text style={styles.initialeTexte}>{boutique.nom.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.nom}>{boutique.nom}</Text>
                  {boutique.description ? <Text style={styles.discret}>{boutique.description}</Text> : null}
                </View>
              </View>

              <View style={styles.carte}>
                <Ionicons name="location-outline" size={17} color={couleurs.inkSoft} />
                <Text style={styles.texte}>
                  {boutique.adresse ? `${boutique.adresse} · ` : ""}
                  {boutique.ville}
                </Text>
              </View>

              <Text style={styles.rubrique}>
                {produits.length} PRODUIT{produits.length > 1 ? "S" : ""} EN VENTE
              </Text>
            </View>
          }
          vide={<EtatVide titre="Aucun produit en vente" texte="Cette boutique n'a encore rien publié." />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  barre: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  barreTitre: { flex: 1, fontSize: 18, fontWeight: "700", color: couleurs.ink },
  entete: { gap: 14, paddingHorizontal: 16, paddingBottom: 12 },
  identite: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: couleurs.placeholder },
  initiale: { alignItems: "center", justifyContent: "center", backgroundColor: couleurs.accentSoft },
  initialeTexte: { fontSize: 24, fontWeight: "700", color: couleurs.accent },
  nom: { fontSize: 20, fontWeight: "800", color: couleurs.ink },
  discret: { fontSize: 14, color: couleurs.inkSoft, lineHeight: 20 },
  carte: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: couleurs.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.line,
  },
  texte: { flex: 1, fontSize: 14, color: couleurs.ink },
  rubrique: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: couleurs.inkSoft, marginTop: 4 },
});
