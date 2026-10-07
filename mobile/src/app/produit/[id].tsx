import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { FeuilleSignalement } from "../../composants/FeuilleSignalement";
import { lireProduit, type Produit } from "../../lib/catalogue";
import { formatGnf, lienWhatsApp } from "../../lib/format";
import { ouvrirFil } from "../../lib/messages";
import { MOTIFS_PRODUIT, signalerProduit } from "../../lib/moderation";
import { useComptes } from "../../lib/profil";
import { couleurs } from "../../theme";

/**
 * La fiche produit. Seule différence avec le site : les compteurs
 * `contact_ouvert` et `whatsapp_ouvert` ne sont pas écrits, ils exigent le
 * serveur, que l'app n'a pas.
 */
export default function FicheProduit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [produit, setProduit] = useState<Produit | null | undefined>(undefined);
  const [erreur, setErreur] = useState(false);
  const [photo, setPhoto] = useState(0);
  const { width } = useWindowDimensions();
  const marges = useSafeAreaInsets();
  const comptes = useComptes();
  const [ouverture, setOuverture] = useState(false);
  const [signalement, setSignalement] = useState(false);

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

  /** Signaler demande un compte : la plainte doit venir de quelqu'un (« reports: je signale »). */
  function ouvrirSignalement() {
    if (comptes.session) {
      setSignalement(true);
      return;
    }
    Alert.alert("Connectez-vous pour signaler", "Un signalement est lu par notre équipe : il doit venir d'un compte.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se connecter", onPress: () => router.push("/connexion") },
    ]);
  }

  /** Même parcours que `/produit/[id]/contacter` du site. */
  async function contacter() {
    if (!produit) return;
    if (!comptes.session) {
      Alert.alert(
        "Créez un compte pour écrire",
        "Le vendeur a besoin de savoir qui le contacte. La création du compte prend moins d'une minute.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "J'ai déjà un compte", onPress: () => router.push("/connexion") },
          { text: "Créer mon compte", onPress: () => router.push("/inscription") },
        ],
      );
      return;
    }
    if (!comptes.client) {
      Alert.alert(
        "Il vous faut un compte client",
        "Votre connexion n'a qu'un compte commerçant. Ajoutez un compte client depuis « Mon compte » sur le site, sans changer d'adresse.",
      );
      return;
    }
    if (comptes.client.suspendu) {
      Alert.alert("Compte suspendu", "Votre compte ne permet plus d'écrire. Vos conversations restent consultables.");
      return;
    }
    setOuverture(true);
    try {
      const resultat = await ouvrirFil(comptes.client.id, produit.boutique.id);
      if (resultat.type === "pret") router.push(`/messages/${resultat.filId}?produit=${produit.id}`);
      // Le quota de 20 boutiques par jour est une règle, pas une panne : on le dit tel quel.
      else Alert.alert("Vous avez contacté beaucoup de vendeurs aujourd'hui", resultat.raison);
    } catch {
      Alert.alert("Impossible d'ouvrir la conversation", "Vérifiez votre connexion internet, puis réessayez.");
    } finally {
      setOuverture(false);
    }
  }

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

          <Pressable style={styles.signaler} onPress={ouvrirSignalement} hitSlop={6}>
            <Ionicons name="flag-outline" size={16} color={couleurs.inkSoft} />
            <Text style={styles.discret}>Signaler ce produit</Text>
          </Pressable>
        </View>
      </ScrollView>

      <FeuilleSignalement
        visible={signalement}
        titre="Signaler ce produit"
        motifs={MOTIFS_PRODUIT}
        onEnvoyer={(motif, precisions) =>
          comptes.session
            ? signalerProduit(comptes.session.user.id, produit.id, motif, precisions)
            : Promise.resolve({ ok: false, message: "Connectez-vous pour signaler un produit." })
        }
        onFermer={() => setSignalement(false)}
      />

      <View style={[styles.pied, { paddingBottom: marges.bottom + 12 }]}>
        {vendu ? (
          <View style={[styles.bouton, styles.boutonSecondaire]}>
            <Text style={styles.boutonSecondaireTexte}>Ce produit n'est plus disponible</Text>
          </View>
        ) : comptes.boutiqueId === produit.boutique.id ? (
          /* On ne se contacte pas soi-même : la base le refuse (0016), et
             le compteur « populaires » monterait tout seul. */
          <View style={[styles.bouton, styles.boutonSecondaire]}>
            <Text style={styles.boutonSecondaireTexte}>C'est votre produit</Text>
          </View>
        ) : (
          <View style={styles.boutons}>
            <Pressable
              style={[styles.bouton, { flex: 1 }, ouverture && { opacity: 0.8 }]}
              onPress={contacter}
              disabled={ouverture || !comptes.pret}
            >
              {ouverture ? (
                <ActivityIndicator color={couleurs.onAccent} />
              ) : (
                <>
                  <Ionicons name="chatbubble-outline" size={20} color={couleurs.onAccent} />
                  <Text style={styles.boutonTexte}>Contacter le vendeur</Text>
                </>
              )}
            </Pressable>
            {whatsapp ? (
              <Pressable
                style={[styles.bouton, styles.boutonSecondaire, styles.carre]}
                onPress={() => Linking.openURL(whatsapp)}
                accessibilityLabel={`Contacter ${produit.boutique.nom} sur WhatsApp`}
              >
                <Ionicons name="logo-whatsapp" size={22} color={couleurs.success} />
              </Pressable>
            ) : null}
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
  boutons: { flexDirection: "row", gap: 10 },
  signaler: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 4 },
  carre: { width: 52, paddingVertical: 0 },
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
