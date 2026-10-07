import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Etiquette } from "../../composants/Etiquette";
import { lireProduit, type Produit } from "../../lib/catalogue";
import { formatGnf, lienWhatsApp } from "../../lib/format";
import { couleurs } from "../../theme";

/**
 * La fiche produit. Ce qui manque encore par rapport au site, faute des
 * parcours correspondants : « Contacter le vendeur » (messagerie),
 * « Signaler », et le compteur `whatsapp_ouvert`
 * (écrit côté serveur, que l'app n'a pas encore).
 */
export default function FicheProduit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [produit, setProduit] = useState<Produit | null | undefined>(undefined);
  const [erreur, setErreur] = useState(false);
  const [photo, setPhoto] = useState(0);
  const { width } = useWindowDimensions();
  const marges = useSafeAreaInsets();

  useEffect(() => {
    lireProduit(id)
      .then(setProduit)
      .catch(() => setErreur(true));
  }, [id]);

  const retour = (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      accessibilityLabel="Retour"
      style={[styles.retour, { top: marges.top + 8 }]}
    >
      <Ionicons name="arrow-back" size={22} color={couleurs.ink} />
    </Pressable>
  );

  if (erreur || produit === null) {
    return (
      <SafeAreaView style={[styles.page, styles.centre]}>
        {retour}
        <Text style={styles.titre}>{erreur ? "Impossible de charger ce produit" : "Ce produit n'existe plus"}</Text>
        <Text style={styles.description}>
          {erreur ? "Vérifiez votre connexion internet, puis réessayez." : "Il a été retiré ou n'est plus en vente."}
        </Text>
      </SafeAreaView>
    );
  }
  if (produit === undefined) {
    return (
      <View style={[styles.page, styles.centre]}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }

  const vendu = produit.statut === "sold";
  const whatsapp = lienWhatsApp(produit.boutique.whatsapp);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View>
          {produit.photos.length > 0 ? (
            <FlatList
              data={produit.photos}
              keyExtractor={(url) => url}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPhoto(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item }) => (
                <Image
                  source={item}
                  style={{ width, height: width, backgroundColor: couleurs.placeholder }}
                  contentFit="cover"
                  cachePolicy="disk"
                  accessibilityLabel={produit.titre}
                />
              )}
            />
          ) : (
            <View style={[styles.sansPhoto, { width, height: width }]}>
              <Ionicons name="image-outline" size={48} color={couleurs.inkSoft} />
            </View>
          )}
          {produit.photos.length > 1 ? (
            <View style={styles.points}>
              {produit.photos.map((url, i) => (
                <View key={url} style={[styles.point, i === photo && styles.pointActif]} />
              ))}
            </View>
          ) : null}
          {vendu ? (
            <View style={styles.voileVendu} pointerEvents="none">
              <Text style={styles.vendu}>VENDU</Text>
            </View>
          ) : null}
          {retour}
        </View>

        <View style={styles.corps}>
          <Text style={styles.titre}>{produit.titre}</Text>
          <View style={styles.ligne}>
            <Text style={[styles.prix, vendu && styles.barre]}>{formatGnf(produit.prixGnf)}</Text>
            {produit.negociable && !vendu ? <Etiquette libelle="Négociable" accent /> : null}
          </View>
          {vendu ? null : (
            <View style={styles.ligne}>
              <Ionicons name="checkmark" size={16} color={couleurs.success} />
              <Text style={styles.disponible}>Disponible</Text>
            </View>
          )}

          {produit.description ? <Text style={styles.description}>{produit.description}</Text> : null}

          <Pressable style={styles.boutique} onPress={() => router.push(`/boutique/${produit.boutique.id}`)}>
            {produit.boutique.photoUrl ? (
              <Image source={produit.boutique.photoUrl} style={styles.avatar} cachePolicy="disk" />
            ) : (
              <View style={[styles.avatar, styles.initiale]}>
                <Text style={styles.initialeTexte}>{produit.boutique.nom.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.boutiqueNom} numberOfLines={1}>
                {produit.boutique.nom}
              </Text>
              <Text style={styles.discret} numberOfLines={1}>
                {produit.boutique.adresse ? `${produit.boutique.adresse} · ` : ""}
                {produit.boutique.ville}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={couleurs.inkSoft} />
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.pied, { paddingBottom: marges.bottom + 12 }]}>
        {vendu ? (
          <View style={[styles.bouton, styles.boutonSecondaire]}>
            <Text style={styles.boutonSecondaireTexte}>Ce produit n'est plus disponible</Text>
          </View>
        ) : whatsapp ? (
          <Pressable style={styles.bouton} onPress={() => Linking.openURL(whatsapp)}>
            <Ionicons name="logo-whatsapp" size={20} color={couleurs.onAccent} />
            <Text style={styles.boutonTexte}>Contacter sur WhatsApp</Text>
          </Pressable>
        ) : (
          <View style={[styles.bouton, styles.boutonSecondaire]}>
            <Text style={styles.boutonSecondaireTexte}>Messagerie bientôt disponible dans l'app</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  centre: { alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  retour: {
    position: "absolute",
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  sansPhoto: { backgroundColor: couleurs.placeholder, alignItems: "center", justifyContent: "center" },
  points: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row", gap: 6 },
  point: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255, 255, 255, 0.6)" },
  pointActif: { backgroundColor: couleurs.surface },
  voileVendu: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  vendu: {
    backgroundColor: couleurs.ink,
    color: couleurs.paper,
    fontWeight: "800",
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  corps: { padding: 16, gap: 10 },
  titre: { fontSize: 24, fontWeight: "800", color: couleurs.ink, textAlign: "left" },
  ligne: { flexDirection: "row", alignItems: "center", gap: 8 },
  prix: { fontSize: 28, fontWeight: "800", color: couleurs.ink },
  barre: { color: couleurs.inkSoft, textDecorationLine: "line-through" },
  disponible: { fontSize: 14, fontWeight: "600", color: couleurs.success },
  description: { fontSize: 16, lineHeight: 24, color: couleurs.inkSoft },
  boutique: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: couleurs.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.line,
    marginTop: 4,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: couleurs.placeholder },
  initiale: { alignItems: "center", justifyContent: "center", backgroundColor: couleurs.accentSoft },
  initialeTexte: { fontSize: 18, fontWeight: "700", color: couleurs.accent },
  boutiqueNom: { fontSize: 16, fontWeight: "600", color: couleurs.ink },
  discret: { fontSize: 12, color: couleurs.inkSoft },
  pied: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: couleurs.line, backgroundColor: couleurs.surface },
  bouton: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: couleurs.accent,
    borderRadius: 10,
    paddingVertical: 14,
  },
  boutonTexte: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
  boutonSecondaire: { backgroundColor: couleurs.surface, borderWidth: 1, borderColor: couleurs.line },
  boutonSecondaireTexte: { color: couleurs.inkSoft, fontSize: 15, fontWeight: "600" },
});
