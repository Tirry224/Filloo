import { Image } from "expo-image";
import { Link } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EtatVide } from "../../composants/EtatVide";
import { Etiquette } from "../../composants/Etiquette";
import { FeuilleChoix } from "../../composants/FeuilleChoix";
import { GrilleProduits } from "../../composants/GrilleProduits";
import { Puce } from "../../composants/Puce";
import { VILLE_PAR_DEFAUT, chercherProduits, type Produit } from "../../lib/catalogue";
import { formatGnf } from "../../lib/format";
import { useReferentiel } from "../../lib/referentiel";
import { couleurs } from "../../theme";

type Tri = "recent" | "popular";

/**
 * L'accueil du catalogue, ouvert sans compte (décision de SPEC). Même
 * logique que la page `/` du site : les produits d'UNE ville, filtrés par
 * catégorie, « à la une » en tête.
 */
export default function Catalogue() {
  const referentiel = useReferentiel();
  const { villes, categories, villeParDefaut } = referentiel;
  const [villeId, setVilleId] = useState<number | null>(null);
  const [categorie, setCategorie] = useState<string | null>(null);
  const [tri, setTri] = useState<Tri>("recent");
  const [produits, setProduits] = useState<Produit[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [rafraichit, setRafraichit] = useState(false);
  const [choixVille, setChoixVille] = useState(false);

  useEffect(() => {
    if (villeId === null && villeParDefaut !== null) setVilleId(villeParDefaut);
  }, [villeId, villeParDefaut]);

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
    if (referentiel.erreur) referentiel.reessayer();
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

      {erreur || referentiel.erreur ? (
        <EtatVide
          icone="cloud-offline-outline"
          titre="Impossible de charger les produits"
          texte="Vérifiez votre connexion internet, puis réessayez."
          action={{ libelle: "Réessayer", onPress: rafraichir }}
        />
      ) : produits === null ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={couleurs.accent} />
      ) : (
        <GrilleProduits
          produits={grille}
          entete={entete}
          rafraichit={rafraichit}
          onRafraichir={rafraichir}
          vide={
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

      <FeuilleChoix
        titre="Choisir une ville"
        visible={choixVille}
        choix={villes.map((v) => ({ libelle: v.name, valeur: v.id }))}
        actuel={villeId}
        onChoisir={setVilleId}
        onFermer={() => setChoixVille(false)}
      />
    </SafeAreaView>
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
});
