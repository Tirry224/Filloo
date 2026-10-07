import { Redirect, Stack, router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { EtatVide } from "../../composants/EtatVide";
import { ContexteCommercant } from "../../lib/contexte-commercant";
import { retenirEspace, useCompteCommercant } from "../../lib/vendeur";
import { couleurs } from "../../theme";

/**
 * La frontière de l'espace commerçant, comme `(vendeur)/layout.tsx` du
 * site : aucun écran de `/vendeur` ne s'affiche sans compte commerçant
 * actif. Elle protège le PARCOURS ; les données, c'est le RLS.
 */
export default function EspaceCommercant() {
  const { session, compte, erreur, recharger } = useCompteCommercant();

  useEffect(() => {
    if (compte && !compte.suspendu) retenirEspace("merchant");
  }, [compte]);

  if (erreur) {
    return (
      <View style={{ flex: 1, backgroundColor: couleurs.paper, justifyContent: "center" }}>
        <EtatVide
          icone="cloud-offline-outline"
          titre="Impossible d'ouvrir votre espace"
          texte="Vérifiez votre connexion internet, puis réessayez."
          action={{ libelle: "Réessayer", onPress: recharger }}
          actionSecondaire={{ libelle: "Revenir au catalogue", onPress: () => router.replace("/") }}
        />
      </View>
    );
  }
  if (compte === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: couleurs.paper, justifyContent: "center" }}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }
  if (!session) return <Redirect href="/connexion" />;
  if (!compte) return <Redirect href="/" />;
  if (compte.suspendu) {
    return (
      <View style={{ flex: 1, backgroundColor: couleurs.paper, justifyContent: "center" }}>
        <EtatVide
          icone="lock-closed-outline"
          titre="Votre boutique est suspendue"
          texte="Vous ne pouvez plus publier ni répondre. Le catalogue reste consultable. Si vous pensez qu'il s'agit d'une erreur, écrivez-nous depuis la page Contact du site."
          action={{ libelle: "Voir les produits", onPress: () => router.replace("/") }}
        />
      </View>
    );
  }

  return (
    <ContexteCommercant.Provider value={{ compte, recharger }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: couleurs.paper } }} />
    </ContexteCommercant.Provider>
  );
}
