import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EtatVide } from "../../../composants/EtatVide";
import { FeuilleChoix } from "../../../composants/FeuilleChoix";
import { lireCategories, type Option } from "../../../lib/catalogue";
import { useCommercant } from "../../../lib/contexte-commercant";
import {
  DESCRIPTION_MAX,
  PHOTOS_MAX,
  TITRE_MAX,
  creerProduit,
  envoyerPhoto,
  formaterSaisiePrix,
  lireProduitAEditer,
  modifierProduit,
  nouvelIdentifiant,
} from "../../../lib/edition-produit";
import { couleurs } from "../../../theme";

const urlStockage = process.env.EXPO_PUBLIC_SUPABASE_URL;

/** Une photo du formulaire : envoyée (`chemin`), en cours, ou en échec. */
type Photo = { cle: string; apercu: string; chemin: string | null; envoi: boolean; erreur: boolean };

/**
 * Créer (`/vendeur/produit/nouveau`) ou modifier un produit. Les photos
 * partent dès qu'on les choisit, comme sur le site : à l'enregistrement,
 * il ne reste qu'à écrire la base. Retirer une photo ici ne supprime
 * aucun fichier — c'est l'enregistrement qui tranche.
 */
export default function FormulaireProduit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const creation = id === "nouveau";
  const { compte } = useCommercant();
  const boutiqueId = compte.boutique!.id;

  /* L'identifiant est fixé UNE fois : les photos sont rangées sous lui
     avant même que le produit existe en base. */
  const produitId = useRef(creation ? nouvelIdentifiant() : id).current;

  const [categories, setCategories] = useState<Option[]>([]);
  const [charge, setCharge] = useState(creation);
  const [introuvable, setIntrouvable] = useState(false);
  const [statut, setStatut] = useState("draft");
  const [titre, setTitre] = useState("");
  const [categorieId, setCategorieId] = useState<number | null>(null);
  const [prix, setPrix] = useState("");
  const [negociable, setNegociable] = useState(false);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [choixCategorie, setChoixCategorie] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    lireCategories().then(setCategories).catch(() => {});
    if (creation) return;
    lireProduitAEditer(produitId)
      .then((p) => {
        if (!p) {
          setIntrouvable(true);
          return;
        }
        setTitre(p.titre);
        setCategorieId(p.categorieId);
        setPrix(p.prix);
        setNegociable(p.negociable);
        setDescription(p.description);
        setStatut(p.statut);
        setPhotos(
          p.photos.map((chemin) => ({
            cle: chemin,
            apercu: `${urlStockage}/storage/v1/object/public/product-images/${chemin}`,
            chemin,
            envoi: false,
            erreur: false,
          })),
        );
      })
      .catch(() => setIntrouvable(true))
      .finally(() => setCharge(true));
  }, [creation, produitId]);

  async function ajouterPhotos(depuisAppareil: boolean) {
    const place = PHOTOS_MAX - photos.length;
    if (place <= 0) return;
    let resultat: ImagePicker.ImagePickerResult;
    if (depuisAppareil) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Appareil photo refusé", "Autorisez l'appareil photo dans les réglages du téléphone pour prendre une photo.");
        return;
      }
      resultat = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    } else {
      resultat = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: place,
        quality: 1,
      });
    }
    if (resultat.canceled) return;

    const choisies = resultat.assets.slice(0, place).map((a) => ({ asset: a, cle: nouvelIdentifiant() }));
    setPhotos((p) => [...p, ...choisies.map(({ asset, cle }) => ({ cle, apercu: asset.uri, chemin: null, envoi: true, erreur: false }))]);
    await Promise.all(
      choisies.map(async ({ asset, cle }) => {
        try {
          const chemin = await envoyerPhoto({ uri: asset.uri, largeur: asset.width, hauteur: asset.height, boutiqueId, produitId });
          setPhotos((p) => p.map((x) => (x.cle === cle ? { ...x, chemin, envoi: false } : x)));
        } catch (e) {
          console.error("[photo produit] envoi échoué :", e);
          setPhotos((p) => p.map((x) => (x.cle === cle ? { ...x, envoi: false, erreur: true } : x)));
        }
      }),
    );
  }

  function choisirSource() {
    Alert.alert("Ajouter une photo", undefined, [
      { text: "Prendre une photo", onPress: () => ajouterPhotos(true) },
      { text: "Choisir dans la galerie", onPress: () => ajouterPhotos(false) },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  async function enregistrer(publier: boolean) {
    if (photos.some((p) => p.envoi)) {
      setErreur("Une photo est encore en cours d'envoi. Attendez qu'elle s'affiche, puis réessayez.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    const saisie = {
      titre,
      categorieId,
      prix,
      negociable,
      description,
      // Une photo en échec n'est pas enregistrée : elle n'existe pas dans le stockage.
      photos: photos.flatMap((p) => (p.chemin ? [p.chemin] : [])),
    };
    const refus = creation
      ? await creerProduit({ produitId, boutiqueId, saisie, publier })
      : await modifierProduit({ produitId, saisie, publier });
    setEnvoi(false);
    if (refus) {
      setErreur(refus);
      return;
    }
    router.back();
  }

  const fermer = () => (router.canGoBack() ? router.back() : router.replace("/vendeur/produits"));

  if (introuvable) {
    return (
      <SafeAreaView style={styles.page}>
        <EtatVide
          icone="cube-outline"
          titre="Produit introuvable"
          texte="Il a été supprimé, ou il n'est pas à vous."
          action={{ libelle: "Revenir à mes produits", onPress: fermer }}
        />
      </SafeAreaView>
    );
  }
  if (!charge) {
    return (
      <View style={[styles.page, { justifyContent: "center" }]}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }

  const categorie = categories.find((c) => c.id === categorieId)?.name;
  const brouillon = creation || statut === "draft";

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <View style={styles.barre}>
        <Pressable onPress={fermer} accessibilityLabel="Fermer" hitSlop={8}>
          <Ionicons name="close" size={26} color={couleurs.ink} />
        </Pressable>
        <Text style={styles.barreTitre}>{creation ? "Nouveau produit" : "Modifier le produit"}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={styles.libelle}>
            Photos <Text style={styles.discret}>({photos.length}/{PHOTOS_MAX}, la première sert de couverture)</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {photos.map((p, i) => (
              <View key={p.cle} style={styles.photo}>
                <Image source={p.apercu} style={StyleSheet.absoluteFill} contentFit="cover" />
                {p.envoi ? (
                  <View style={styles.voilePhoto}>
                    <ActivityIndicator color={couleurs.onAccent} />
                  </View>
                ) : p.erreur ? (
                  <View style={styles.voilePhoto}>
                    <Text style={styles.echec}>Échec de l'envoi</Text>
                  </View>
                ) : null}
                {i === 0 && !p.erreur ? <Text style={styles.couverture}>Couverture</Text> : null}
                <Pressable
                  style={styles.retirer}
                  onPress={() => setPhotos((x) => x.filter((y) => y.cle !== p.cle))}
                  accessibilityLabel="Retirer la photo"
                  hitSlop={6}
                >
                  <Ionicons name="close" size={16} color={couleurs.onAccent} />
                </Pressable>
              </View>
            ))}
            {photos.length < PHOTOS_MAX ? (
              <Pressable style={[styles.photo, styles.ajout]} onPress={choisirSource}>
                <Ionicons name="camera-outline" size={26} color={couleurs.accent} />
                <Text style={styles.ajoutTexte}>Ajouter</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <Text style={styles.libelle}>Titre</Text>
          <TextInput
            style={styles.champ}
            value={titre}
            onChangeText={setTitre}
            placeholder="Ex. : Pagne wax 6 yards"
            placeholderTextColor={couleurs.inkSoft}
            maxLength={TITRE_MAX}
          />

          <Text style={styles.libelle}>Catégorie</Text>
          <Pressable style={[styles.champ, styles.selecteur]} onPress={() => setChoixCategorie(true)}>
            <Text style={{ fontSize: 16, color: categorie ? couleurs.ink : couleurs.inkSoft }}>{categorie ?? "Choisir"}</Text>
            <Ionicons name="chevron-down" size={18} color={couleurs.inkSoft} />
          </Pressable>

          <Text style={styles.libelle}>Prix (GNF)</Text>
          <TextInput
            style={styles.champ}
            value={prix}
            onChangeText={(v) => setPrix(formaterSaisiePrix(v))}
            placeholder="450 000"
            placeholderTextColor={couleurs.inkSoft}
            keyboardType="number-pad"
          />

          <View style={styles.interrupteur}>
            <Text style={styles.libelle}>Prix négociable</Text>
            <Switch value={negociable} onValueChange={setNegociable} trackColor={{ true: couleurs.accent }} thumbColor={couleurs.surface} />
          </View>

          <Text style={styles.libelle}>
            Description <Text style={styles.discret}>(facultatif)</Text>
          </Text>
          <TextInput
            style={[styles.champ, { minHeight: 100, textAlignVertical: "top" }]}
            value={description}
            onChangeText={setDescription}
            placeholder="État, taille, couleur, où le voir…"
            placeholderTextColor={couleurs.inkSoft}
            multiline
            maxLength={DESCRIPTION_MAX}
          />

          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
        </ScrollView>

        <View style={styles.pied}>
          {brouillon ? (
            <>
              <Pressable style={styles.bouton} onPress={() => enregistrer(true)} disabled={envoi}>
                {envoi ? <ActivityIndicator color={couleurs.onAccent} /> : <Text style={styles.boutonTexte}>Publier</Text>}
              </Pressable>
              <Pressable style={[styles.bouton, styles.secondaire]} onPress={() => enregistrer(false)} disabled={envoi}>
                <Text style={styles.secondaireTexte}>Enregistrer en brouillon</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.bouton} onPress={() => enregistrer(false)} disabled={envoi}>
              {envoi ? <ActivityIndicator color={couleurs.onAccent} /> : <Text style={styles.boutonTexte}>Enregistrer</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <FeuilleChoix
        titre="Catégorie"
        visible={choixCategorie}
        choix={categories.map((c) => ({ libelle: c.name, valeur: c.id as number | null }))}
        actuel={categorieId}
        onChoisir={setCategorieId}
        onFermer={() => setChoixCategorie(false)}
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
  contenu: { padding: 16, gap: 8 },
  libelle: { fontSize: 14, fontWeight: "600", color: couleurs.ink, marginTop: 8 },
  discret: { fontWeight: "400", color: couleurs.inkSoft },
  photo: { width: 96, height: 96, borderRadius: 10, overflow: "hidden", backgroundColor: couleurs.placeholder },
  voilePhoto: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(39, 31, 24, 0.5)", alignItems: "center", justifyContent: "center" },
  echec: { color: couleurs.onAccent, fontSize: 11, fontWeight: "700", textAlign: "center", padding: 4 },
  couverture: {
    position: "absolute",
    left: 4,
    bottom: 4,
    fontSize: 10,
    fontWeight: "700",
    color: couleurs.onAccent,
    backgroundColor: "rgba(39, 31, 24, 0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },
  retirer: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(39, 31, 24, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  ajout: { alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderStyle: "dashed", borderColor: couleurs.accent, backgroundColor: couleurs.accentSoft },
  ajoutTexte: { fontSize: 13, fontWeight: "600", color: couleurs.accent },
  champ: {
    borderWidth: 1,
    borderColor: couleurs.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: couleurs.ink,
    backgroundColor: couleurs.surface,
  },
  selecteur: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  interrupteur: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  erreur: { fontSize: 14, color: couleurs.danger, marginTop: 8 },
  pied: { gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: couleurs.line, backgroundColor: couleurs.surface },
  bouton: { backgroundColor: couleurs.accent, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  boutonTexte: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
  secondaire: { backgroundColor: couleurs.surface, borderWidth: 1, borderColor: couleurs.line },
  secondaireTexte: { color: couleurs.ink, fontSize: 16, fontWeight: "600" },
});
