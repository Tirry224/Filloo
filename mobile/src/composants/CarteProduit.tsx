import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Produit } from "../lib/catalogue";
import { formatGnf } from "../lib/format";
import { couleurs } from "../theme";
import { Etiquette } from "./Etiquette";

/** Une case de la grille du catalogue : photo, titre, prix, boutique. */
export function CarteProduit({ produit }: { produit: Produit }) {
  const vendu = produit.statut === "sold";
  return (
    <Link href={`/produit/${produit.id}`} asChild>
      {/* Un seul objet de style, jamais un tableau : `Link asChild` le
          recopie tel quel, et le web refuse un tableau sur un élément HTML. */}
      <Pressable style={StyleSheet.flatten([styles.carte, vendu && { opacity: 0.6 }])}>
        <Image
          source={produit.photos[0]}
          style={styles.photo}
          contentFit="cover"
          /* Le disque d'abord : les données mobiles coûtent cher, une photo
             déjà vue ne se retélécharge pas. */
          cachePolicy="disk"
          transition={150}
          accessibilityLabel={produit.titre}
        />
        <View style={styles.corps}>
          <Text style={styles.titre} numberOfLines={2}>
            {produit.titre}
          </Text>
          <Text style={[styles.prix, vendu && styles.barre]}>{formatGnf(produit.prixGnf)}</Text>
          <Text style={styles.boutique} numberOfLines={1}>
            {produit.boutique.nom} · {produit.boutique.ville}
          </Text>
          {vendu ? <Etiquette libelle="Vendu" /> : produit.negociable ? <Etiquette libelle="Négociable" accent /> : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  carte: {
    flex: 1,
    backgroundColor: couleurs.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.line,
    overflow: "hidden",
  },
  photo: { width: "100%", aspectRatio: 1, backgroundColor: couleurs.placeholder },
  corps: { padding: 10, gap: 4 },
  titre: { fontSize: 14, fontWeight: "600", color: couleurs.ink, lineHeight: 18 },
  prix: { fontSize: 16, fontWeight: "800", color: couleurs.ink },
  barre: { color: couleurs.inkSoft, textDecorationLine: "line-through" },
  boutique: { fontSize: 12, color: couleurs.inkSoft },
});
