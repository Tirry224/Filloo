import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CarteProduit } from "../../composants/CarteProduit";
import { Etiquette } from "../../composants/Etiquette";
import { Puce } from "../../composants/Puce";
import {
  VILLE_PAR_DEFAUT,
  chercherProduits,
  lireCategories,
  lireVilleDuCompte,
  lireVilles,
  type Option,
  type Produit,
} from "../../lib/catalogue";
import { formatGnf } from "../../lib/format";
import { useSession } from "../../lib/session";
import { couleurs } from "../../theme";

type Tri = "recent" | "popular";

/**
 * L'accueil du catalogue, ouvert sans compte (décision de SPEC). Même
 * logique que la page `/` du site : les produits d'UNE ville, filtrés par
 * catégorie, « à la une » en tête.
 */
export default function Catalogue() {
  const { session, chargement: chargementSession } = useSession();
  const [villes, setVilles] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [villeId, setVilleId] = useState<number | null>(null);
  const [categorie, setCategorie] = useState<string | null>(null);
  const [tri, setTri] = useState<Tri>("recent");
  const [produits, setProduits] = useState<Produit[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [rafraichit, setRafraichit] = useState(false);
  const [choixVille, setChoixVille] = useState(false);

  /* Les listes de référence, et la ville de départ : celle du compte
     client, sinon Conakry. Attendre la session évite de partir sur
     Conakry puis de sauter vers la ville du compte. */
  useEffect(() => {
    if (chargementSession) return;
    Promise.all([lireVilles(), lireCategories(), lireVilleDuCompte(session?.user.id)])
      .then(([v, c, villeDuCompte]) => {
        setVilles(v);
        setCategories(c);
        const depart = v.find((x) => x.id === villeDuCompte) ?? v.find((x) => x.name === VILLE_PAR_DEFAUT) ?? v[0];
        setVilleId(depart?.id ?? null);
      })
      .catch(() => setErreur(true));
  }, [chargementSession, session?.user.id]);

  const charger = useCallback(async () => {
    if (villeId === null) return;
    setErreur(false);
    try {
      setProduits(await chercherProduits({ villeId, categorieId: null, tri }));
    } catch {
      setErreur(true);
    }
  }, [villeId, tri]);

  useEffect(() => {
    setProduits(null);
    charger();
  }, [charger]);

  async function rafraichir() {
    setRafraichit(true);
    await charger();
    setRafraichit(false);
  }

  const ville = villes.find((v) => v.id === villeId)?.name ?? VILLE_PAR_DEFAUT;

  /* Comme le site : la ville est demandée au serveur, la catégorie filtrée
     ici. C'est ce qui permet de dire « rien dans cette catégorie, mais il
     y a des produits dans la ville ». */
  const visibles = useMemo(
    () => (produits ?? []).filter((p) => categorie === null || p.categorie === categorie),
    [produits, categorie],
  );
  const aLaUne = visibles.find((p) => p.aLaUne) ?? null;
  const grille = aLaUne ? visibles.filter((p) => p.id !== aLaUne.id) : visibles;

  const entete = (
    <View style={styles.entete}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.puces}>
        <Puce libelle="Tout" active={categorie === null} onPress={() => setCategorie(null)} />
        {categories.map((c) => (
          <Puce key={c.id} libelle={c.name} active={categorie === c.name} onPress={() => setCategorie(c.name)} />
        ))}
      </ScrollView>

      {aLaUne ? (
        <View style={styles.bloc}>
          <Text style={styles.rubrique}>À LA UNE</Text>
          <Link href={`/produit/${aLaUne.id}`} asChild>
            <Pressable style={styles.une}>
              <Image source={aLaUne.photos[0]} style={styles.unePhoto} contentFit="cover" cachePolicy="disk" />
              <View style={styles.uneCorps}>
                <Text style={styles.uneTitre} numberOfLines={2}>
                  {aLaUne.titre}
                </Text>
                <Text style={styles.prix}>{formatGnf(aLaUne.prixGnf)}</Text>
                <Text style={styles.discret} numberOfLines={1}>
                  {aLaUne.boutique.nom} · {aLaUne.boutique.ville}
                </Text>
                {aLaUne.negociable ? <Etiquette libelle="Négociable" accent /> : null}
              </View>
            </Pressable>
          </Link>
        </View>
      ) : null}

      {visibles.length > 0 ? (
        <View style={styles.tris}>
          <Pressable onPress={() => setTri("recent")} disabled={tri === "recent"}>
            <Text style={tri === "recent" ? styles.rubrique : styles.lien}>{tri === "recent" ? "RÉCENTS" : "Récents"}</Text>
          </Pressable>
          <Pressable onPress={() => setTri("popular")} disabled={tri === "popular"}>
            <Text style={tri === "popular" ? styles.rubrique : styles.lien}>
              {tri === "popular" ? "POPULAIRES" : "Populaires"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <View style={styles.barre}>
        <Text style={styles.marque}>Filloo</Text>
        <Puce libelle={ville} icone="location-outline" onPress={() => setChoixVille(true)} />
      </View>

      {erreur ? (
        <EtatVide
          titre="Impossible de charger les produits"
          texte="Vérifiez votre connexion internet, puis réessayez."
          action={{ libelle: "Réessayer", onPress: rafraichir }}
        />
      ) : produits === null ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={couleurs.accent} />
      ) : (
        <FlatList
          data={grille}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.ligne}
          contentContainerStyle={styles.liste}
          ListHeaderComponent={entete}
          renderItem={({ item }) => (
            <View style={styles.case}>
              <CarteProduit produit={item} />
            </View>
          )}
          refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={couleurs.accent} />}
          ListEmptyComponent={
            aLaUne ? null : categorie !== null && produits.length > 0 ? (
              <EtatVide
                titre={`Aucun produit « ${categorie} » à ${ville}`}
                texte="Essayez une autre catégorie, ou regardez tout ce qui est en vente dans cette ville."
                action={{ libelle: "Voir toutes les catégories", onPress: () => setCategorie(null) }}
              />
            ) : (
              <EtatVide
                titre={`Aucun produit à ${ville} pour le moment`}
                texte="Filloo démarre à Conakry. Changez de ville pour voir ce qui est en vente."
                action={
                  ville !== VILLE_PAR_DEFAUT
                    ? {
                        libelle: `Voir les produits à ${VILLE_PAR_DEFAUT}`,
                        onPress: () => setVilleId(villes.find((v) => v.name === VILLE_PAR_DEFAUT)?.id ?? null),
                      }
                    : undefined
                }
              />
            )
          }
        />
      )}

      <Modal visible={choixVille} animationType="slide" transparent onRequestClose={() => setChoixVille(false)}>
        <Pressable style={styles.voile} onPress={() => setChoixVille(false)} />
        <SafeAreaView style={styles.feuille} edges={["bottom"]}>
          <Text style={styles.feuilleTitre}>Choisir une ville</Text>
          <ScrollView>
            {villes.map((v) => (
              <Pressable
                key={v.id}
                style={styles.choix}
                onPress={() => {
                  setVilleId(v.id);
                  setChoixVille(false);
                }}
              >
                <Text style={styles.choixTexte}>{v.name}</Text>
                {v.id === villeId ? <Ionicons name="checkmark" size={20} color={couleurs.accent} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function EtatVide({
  titre,
  texte,
  action,
}: {
  titre: string;
  texte: string;
  action?: { libelle: string; onPress: () => void };
}) {
  return (
    <View style={styles.vide}>
      <Ionicons name="cube-outline" size={40} color={couleurs.inkSoft} />
      <Text style={styles.videTitre}>{titre}</Text>
      <Text style={styles.videTexte}>{texte}</Text>
      {action ? (
        <Pressable style={styles.bouton} onPress={action.onPress}>
          <Text style={styles.boutonTexte}>{action.libelle}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  barre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  marque: { fontSize: 28, fontWeight: "800", color: couleurs.accent },
  entete: { gap: 14, paddingBottom: 10 },
  puces: { gap: 8, paddingHorizontal: 16 },
  bloc: { gap: 8, paddingHorizontal: 16 },
  rubrique: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: couleurs.inkSoft },
  lien: { fontSize: 14, fontWeight: "600", color: couleurs.accent },
  une: {
    flexDirection: "row",
    backgroundColor: couleurs.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.line,
    overflow: "hidden",
  },
  unePhoto: { width: 104, backgroundColor: couleurs.placeholder },
  uneCorps: { flex: 1, padding: 12, gap: 4, justifyContent: "center" },
  uneTitre: { fontSize: 16, fontWeight: "600", color: couleurs.ink },
  prix: { fontSize: 16, fontWeight: "800", color: couleurs.ink },
  discret: { fontSize: 12, color: couleurs.inkSoft },
  tris: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 16 },
  liste: { paddingBottom: 24 },
  ligne: { gap: 10, paddingHorizontal: 16 },
  case: { flex: 1, maxWidth: "50%", marginBottom: 10 },
  vide: { alignItems: "center", gap: 8, padding: 32 },
  videTitre: { fontSize: 18, fontWeight: "700", color: couleurs.ink, textAlign: "center" },
  videTexte: { fontSize: 14, color: couleurs.inkSoft, textAlign: "center", lineHeight: 20 },
  bouton: { backgroundColor: couleurs.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, marginTop: 8 },
  boutonTexte: { color: couleurs.onAccent, fontSize: 15, fontWeight: "700" },
  voile: { flex: 1, backgroundColor: "rgba(39, 31, 24, 0.45)" },
  feuille: {
    maxHeight: "70%",
    backgroundColor: couleurs.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
  },
  feuilleTitre: { fontSize: 18, fontWeight: "700", color: couleurs.ink, paddingHorizontal: 16, paddingBottom: 8 },
  choix: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: couleurs.line,
  },
  choixTexte: { fontSize: 16, color: couleurs.ink },
});
