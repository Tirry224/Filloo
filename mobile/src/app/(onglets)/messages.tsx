import { Image } from "expo-image";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EtatVide } from "../../composants/EtatVide";
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
        renderItem={({ item }) => <LigneFil fil={item} />}
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

function LigneFil({ fil }: { fil: ResumeFil }) {
  const nonLu = fil.nonLus > 0;
  const image = fil.produitPhotoUrl ?? fil.photoUrl;
  return (
    <Link href={`/messages/${fil.id}`} asChild>
      <Pressable style={styles.ligne}>
        {image ? (
          <Image source={image} style={styles.vignette} cachePolicy="disk" />
        ) : (
          <View style={[styles.vignette, styles.initiale]}>
            <Text style={styles.initialeTexte}>{fil.interlocuteur.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.haut}>
            <Text style={[styles.nom, nonLu && styles.gras]} numberOfLines={1}>
              {fil.interlocuteur}
            </Text>
            <Text style={[styles.quand, nonLu && { color: couleurs.accent }]}>{fil.dernierQuand}</Text>
          </View>
          {fil.produit ? (
            <Text style={styles.produit} numberOfLines={1}>
              {fil.produit}
            </Text>
          ) : null}
          <View style={styles.haut}>
            <Text style={[styles.apercu, nonLu && styles.apercuNonLu]} numberOfLines={1}>
              {fil.dernierMessage}
            </Text>
            {nonLu ? <Text style={styles.badge}>{fil.nonLus}</Text> : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  titre: { fontSize: 28, fontWeight: "800", color: couleurs.ink, paddingHorizontal: 16, paddingVertical: 10 },
  ligne: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.line,
  },
  vignette: { width: 52, height: 52, borderRadius: 10, backgroundColor: couleurs.placeholder },
  initiale: { alignItems: "center", justifyContent: "center", backgroundColor: couleurs.accentSoft },
  initialeTexte: { fontSize: 20, fontWeight: "700", color: couleurs.accent },
  haut: { flexDirection: "row", alignItems: "center", gap: 8 },
  nom: { flex: 1, fontSize: 16, fontWeight: "600", color: couleurs.ink },
  gras: { fontWeight: "800" },
  quand: { fontSize: 12, color: couleurs.inkSoft },
  produit: { fontSize: 12, color: couleurs.inkSoft },
  apercu: { flex: 1, fontSize: 14, color: couleurs.inkSoft },
  apercuNonLu: { color: couleurs.ink, fontWeight: "600" },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: couleurs.accent,
    color: couleurs.onAccent,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
