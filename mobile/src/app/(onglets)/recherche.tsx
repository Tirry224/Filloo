import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EtatVide } from "../../composants/EtatVide";
import { FeuilleChoix } from "../../composants/FeuilleChoix";
import { GrilleProduits } from "../../composants/GrilleProduits";
import { Puce } from "../../composants/Puce";
import { VILLE_PAR_DEFAUT, chercherProduits, compterAilleurs, type Produit } from "../../lib/catalogue";
import { effacerRecherches, lireRecherches, retenirRecherche } from "../../lib/recherches-recentes";
import { useReferentiel } from "../../lib/referentiel";
import { couleurs } from "../../theme";

type Tri = "recent" | "popular";
type Feuille = "ville" | "categorie" | "tri" | null;

/** Icône par catégorie, reconnue à un mot du nom (comme `CategoryGrid` du site). */
const ICONES: { mot: string; icone: ComponentProps<typeof Ionicons>["name"] }[] = [
  { mot: "alimentation", icone: "restaurant-outline" },
  { mot: "vêtements", icone: "shirt-outline" },
  { mot: "électronique", icone: "phone-portrait-outline" },
  { mot: "beauté", icone: "sparkles-outline" },
  { mot: "maison", icone: "home-outline" },
  { mot: "matériaux", icone: "hammer-outline" },
  { mot: "enfants", icone: "happy-outline" },
  { mot: "sport", icone: "football-outline" },
  { mot: "véhicules", icone: "car-outline" },
];
const iconePour = (nom: string) => ICONES.find((c) => nom.toLowerCase().includes(c.mot))?.icone ?? "pricetag-outline";

/**
 * La recherche, même logique que `/recherche` du site : un mot, une ville,
 * une catégorie, un tri. Au repos, les recherches récentes et les
 * catégories. Sans résultat, on dit combien de produits correspondent
 * ailleurs, pour que la personne sache que c'est la ville qui bloque.
 */
export default function Recherche() {
  const referentiel = useReferentiel();
  const { villes, categories, villeParDefaut } = referentiel;
  const [saisie, setSaisie] = useState("");
  const [texte, setTexte] = useState("");
  const [villeId, setVilleId] = useState<number | null>(null);
  const [categorieId, setCategorieId] = useState<number | null>(null);
  const [tri, setTri] = useState<Tri>("recent");
  const [resultats, setResultats] = useState<Produit[] | null>(null);
  const [ailleurs, setAilleurs] = useState<{ nombre: number; auPlafond: boolean }>({ nombre: 0, auPlafond: false });
  const [erreur, setErreur] = useState(false);
  const [recentes, setRecentes] = useState<string[]>([]);
  const [feuille, setFeuille] = useState<Feuille>(null);

  useEffect(() => {
    lireRecherches().then(setRecentes);
  }, []);

  useEffect(() => {
    if (villeId === null && villeParDefaut !== null) setVilleId(villeParDefaut);
  }, [villeId, villeParDefaut]);

  const auRepos = !texte && categorieId === null;

  const chercher = useCallback(async () => {
    if (villeId === null || auRepos) return;
    setErreur(false);
    setResultats(null);
    try {
      const trouves = await chercherProduits({ villeId, categorieId, tri, texte });
      setResultats(trouves);
      setAilleurs(trouves.length === 0 ? await compterAilleurs({ texte, categorieId }) : { nombre: 0, auPlafond: false });
    } catch {
      setErreur(true);
    }
  }, [villeId, categorieId, tri, texte, auRepos]);

  useEffect(() => {
    chercher();
  }, [chercher]);

  async function lancer(terme: string) {
    setSaisie(terme);
    setTexte(terme.trim());
    if (terme.trim()) setRecentes(await retenirRecherche(terme));
  }

  function effacerSaisie() {
    setSaisie("");
    setTexte("");
  }

  function effacerFiltres() {
    setVilleId(villeParDefaut);
    setCategorieId(null);
  }

  const ville = villes.find((v) => v.id === villeId)?.name ?? VILLE_PAR_DEFAUT;
  const categorie = categories.find((c) => c.id === categorieId)?.name ?? null;
  const nbFiltres = (villeId !== villeParDefaut ? 1 : 0) + (categorieId !== null ? 1 : 0);

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <View style={styles.barre}>
        <View style={styles.champ}>
          <Ionicons name="search" size={18} color={couleurs.inkSoft} />
          <TextInput
            style={styles.saisie}
            value={saisie}
            onChangeText={setSaisie}
            onSubmitEditing={() => lancer(saisie)}
            placeholder="Rechercher un produit"
            placeholderTextColor={couleurs.inkSoft}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Rechercher un produit"
          />
          {saisie ? (
            <Pressable onPress={effacerSaisie} accessibilityLabel="Effacer la recherche" hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={couleurs.inkSoft} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {referentiel.erreur ? (
        <EtatVide
          icone="cloud-offline-outline"
          titre="Impossible de charger la recherche"
          texte="Vérifiez votre connexion internet, puis réessayez."
          action={{ libelle: "Réessayer", onPress: referentiel.reessayer }}
        />
      ) : auRepos ? (
        <ScrollView contentContainerStyle={styles.repos} keyboardShouldPersistTaps="handled">
          {recentes.length > 0 ? (
            <View>
              <View style={styles.rangee}>
                <Text style={styles.rubrique}>RECHERCHES RÉCENTES</Text>
                <Pressable
                  onPress={() => {
                    effacerRecherches();
                    setRecentes([]);
                  }}
                >
                  <Text style={styles.lien}>Effacer</Text>
                </Pressable>
              </View>
              {recentes.map((r) => (
                <Pressable key={r} style={styles.recente} onPress={() => lancer(r)}>
                  <Ionicons name="time-outline" size={18} color={couleurs.inkSoft} />
                  <Text style={styles.recenteTexte} numberOfLines={1}>
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.rubrique}>PARCOURIR</Text>
          <View style={styles.tuiles}>
            {categories.map((c) => (
              <Pressable key={c.id} style={styles.tuile} onPress={() => setCategorieId(c.id)}>
                <Ionicons name={iconePour(c.name)} size={18} color={couleurs.accent} />
                <Text style={styles.tuileTexte}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : erreur ? (
        <EtatVide
          icone="cloud-offline-outline"
          titre="La recherche n'a pas abouti"
          texte="Vérifiez votre connexion internet, puis réessayez."
          action={{ libelle: "Réessayer", onPress: chercher }}
        />
      ) : resultats === null ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={couleurs.accent} />
      ) : (
        <GrilleProduits
          produits={resultats}
          entete={
            <View style={styles.entete}>
              <Text style={styles.compte}>
                <Text style={styles.gras}>
                  {resultats.length} produit{resultats.length > 1 ? "s" : ""}
                </Text>{" "}
                trouvé{resultats.length > 1 ? "s" : ""}
                {nbFiltres > 0 ? ` · ${nbFiltres} filtre${nbFiltres > 1 ? "s" : ""}` : ""}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.puces}>
                <Puce libelle={ville} icone="location-outline" active={villeId !== villeParDefaut} onPress={() => setFeuille("ville")} />
                <Puce
                  libelle={categorie ?? "Catégorie"}
                  icone="options-outline"
                  active={categorieId !== null}
                  onPress={() => setFeuille("categorie")}
                />
                <Puce
                  libelle={tri === "popular" ? "Populaires" : "Récents"}
                  icone="swap-vertical-outline"
                  onPress={() => setFeuille("tri")}
                />
              </ScrollView>
            </View>
          }
          vide={
            <EtatVide
              icone="search-outline"
              titre={texte ? `Aucun résultat pour « ${texte} »` : "Aucun produit ici"}
              texte={
                ailleurs.nombre > 0
                  ? `${ailleurs.nombre}${
                      ailleurs.auPlafond
                        ? " produits ou plus correspondent"
                        : ` produit${ailleurs.nombre > 1 ? "s" : ""} correspond${ailleurs.nombre > 1 ? "ent" : ""}`
                    } ailleurs en Guinée. C'est le filtre de ville qui bloque, pas votre recherche.`
                  : "Essayez un mot plus court, ou changez de ville."
              }
              action={
                ailleurs.nombre === 0 && ville !== VILLE_PAR_DEFAUT
                  ? {
                      libelle: `Chercher à ${VILLE_PAR_DEFAUT}`,
                      onPress: () => setVilleId(villes.find((v) => v.name === VILLE_PAR_DEFAUT)?.id ?? null),
                    }
                  : ailleurs.nombre > 0
                    ? { libelle: "Changer de ville", onPress: () => setFeuille("ville") }
                    : undefined
              }
              actionSecondaire={{ libelle: "Effacer les filtres", onPress: effacerFiltres }}
            />
          }
        />
      )}

      <FeuilleChoix
        titre="Ville"
        visible={feuille === "ville"}
        choix={villes.map((v) => ({ libelle: v.name, valeur: v.id }))}
        actuel={villeId}
        onChoisir={setVilleId}
        onFermer={() => setFeuille(null)}
      />
      <FeuilleChoix
        titre="Catégorie"
        visible={feuille === "categorie"}
        choix={[
          { libelle: "Toutes catégories", valeur: null },
          ...categories.map((c) => ({ libelle: c.name, valeur: c.id as number | null })),
        ]}
        actuel={categorieId}
        onChoisir={setCategorieId}
        onFermer={() => setFeuille(null)}
      />
      <FeuilleChoix<Tri>
        titre="Trier par"
        visible={feuille === "tri"}
        choix={[
          { libelle: "Récents", valeur: "recent" },
          { libelle: "Populaires", valeur: "popular" },
        ]}
        actuel={tri}
        onChoisir={setTri}
        onFermer={() => setFeuille(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  barre: { paddingHorizontal: 16, paddingVertical: 10 },
  champ: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: couleurs.line,
    backgroundColor: couleurs.surface,
  },
  saisie: { flex: 1, fontSize: 16, color: couleurs.ink, paddingVertical: 0 },
  repos: { padding: 16, gap: 16 },
  rangee: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  rubrique: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: couleurs.inkSoft },
  lien: { fontSize: 14, fontWeight: "600", color: couleurs.accent },
  recente: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.line,
  },
  recenteTexte: { flex: 1, fontSize: 16, color: couleurs.ink },
  tuiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tuile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "48.5%",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.line,
    backgroundColor: couleurs.surface,
  },
  tuileTexte: { flex: 1, fontSize: 14, fontWeight: "600", color: couleurs.ink },
  entete: { gap: 10, paddingBottom: 12 },
  compte: { fontSize: 14, color: couleurs.inkSoft, paddingHorizontal: 16 },
  gras: { fontWeight: "700", color: couleurs.ink },
  puces: { gap: 8, paddingHorizontal: 16 },
});
