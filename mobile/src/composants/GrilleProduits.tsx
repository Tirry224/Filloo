import type { ReactElement } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import type { Produit } from "../lib/catalogue";
import { couleurs } from "../theme";
import { CarteProduit } from "./CarteProduit";

/** La grille à deux colonnes de l'accueil, de la recherche et de la boutique. */
export function GrilleProduits({
  produits,
  entete,
  vide,
  rafraichit,
  onRafraichir,
}: {
  produits: Produit[];
  entete?: ReactElement;
  vide?: ReactElement | null;
  rafraichit?: boolean;
  onRafraichir?: () => void;
}) {
  return (
    <FlatList
      data={produits}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={styles.ligne}
      contentContainerStyle={styles.liste}
      ListHeaderComponent={entete}
      ListEmptyComponent={vide}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <View style={styles.case}>
          <CarteProduit produit={item} />
        </View>
      )}
      refreshControl={
        onRafraichir ? (
          <RefreshControl refreshing={rafraichit ?? false} onRefresh={onRafraichir} tintColor={couleurs.accent} />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  liste: { paddingBottom: 24 },
  ligne: { gap: 10, paddingHorizontal: 16 },
  case: { flex: 1, maxWidth: "50%", marginBottom: 10 },
});
