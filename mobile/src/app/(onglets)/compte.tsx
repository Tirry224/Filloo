import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { creerCompteCommercantLie } from "../../lib/edition-boutique";
import { deconnecter } from "../../lib/notifications";
import { useSession } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { retenirEspace } from "../../lib/vendeur";
import { couleurs } from "../../theme";

type Profil = { id: string; role: "client" | "merchant"; full_name: string };

/**
 * Provisoire : il montre les comptes de la connexion et permet de se
 * déconnecter. Le vrai « Mon compte » viendra avec son parcours.
 */
export default function Compte() {
  const { session } = useSession();
  const [profils, setProfils] = useState<Profil[] | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("auth_user_id", session.user.id)
      .then(({ data, error }) => {
        if (error) setErreur(true);
        else setProfils(data);
      });
  }, [session]);

  async function ouvrirBoutique() {
    if (!session) return;
    const refus = await creerCompteCommercantLie(session.user.id);
    if (refus) {
      Alert.alert("Impossible d'ouvrir la boutique", refus);
      return;
    }
    await retenirEspace("merchant");
    router.replace("/vendeur");
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.page, styles.centre]}>
        <Text style={styles.titre}>Mon compte</Text>
        <Text style={styles.discret}>Le catalogue est ouvert à tous. Un compte sert à contacter les vendeurs.</Text>
        <Link href="/connexion" asChild>
          <Pressable style={styles.bouton}>
            <Text style={styles.boutonTexte}>Se connecter</Text>
          </Pressable>
        </Link>
        <Link href="/inscription" asChild>
          <Pressable style={styles.secondaireSeul}>
            <Text style={styles.secondaireTexte}>Créer un compte</Text>
          </Pressable>
        </Link>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <Text style={styles.titre}>Mon compte</Text>
      <Text style={styles.texte}>{session.user.email}</Text>

      {erreur ? <Text style={styles.erreur}>Impossible de lire vos comptes. Réessayez dans un instant.</Text> : null}
      {profils?.map((p) => (
        <View key={p.id} style={styles.carte}>
          <Text style={styles.texte}>{p.full_name}</Text>
          <Text style={styles.discret}>{p.role === "merchant" ? "Compte commerçant" : "Compte client"}</Text>
        </View>
      ))}

      <Pressable style={styles.entree} onPress={() => router.push("/compte/informations")}>
        <Ionicons name="person-circle-outline" size={20} color={couleurs.ink} />
        <Text style={styles.entreeTexte}>Mes informations</Text>
        <Ionicons name="chevron-forward" size={18} color={couleurs.inkSoft} />
      </Pressable>

      {profils?.some((p) => p.role === "merchant") ? (
        <Pressable
          style={styles.entree}
          onPress={async () => {
            await retenirEspace("merchant");
            router.replace("/vendeur");
          }}
        >
          <Ionicons name="storefront-outline" size={20} color={couleurs.ink} />
          <Text style={styles.entreeTexte}>Passer à l'espace commerçant</Text>
          <Ionicons name="chevron-forward" size={18} color={couleurs.inkSoft} />
        </Pressable>
      ) : profils ? (
        <Pressable style={styles.entree} onPress={ouvrirBoutique}>
          <Ionicons name="storefront-outline" size={20} color={couleurs.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.entreeTexte}>Ouvrir ma boutique</Text>
            <Text style={styles.discret}>Même connexion, un second compte pour vendre.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={couleurs.inkSoft} />
        </Pressable>
      ) : null}

      <Pressable onPress={deconnecter} style={[styles.bouton, styles.secondaire]}>
        <Text style={styles.secondaireTexte}>Se déconnecter</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper, padding: 16, gap: 12 },
  centre: { justifyContent: "center" },
  titre: { fontSize: 28, fontWeight: "800", color: couleurs.ink },
  texte: { fontSize: 16, color: couleurs.ink },
  discret: { fontSize: 14, color: couleurs.inkSoft, lineHeight: 20 },
  erreur: { fontSize: 14, color: couleurs.danger },
  carte: { backgroundColor: couleurs.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: couleurs.line, gap: 4 },
  bouton: { backgroundColor: couleurs.accent, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  boutonTexte: { color: couleurs.onAccent, fontSize: 16, fontWeight: "700" },
  secondaire: { backgroundColor: couleurs.surface, borderWidth: 1, borderColor: couleurs.line, marginTop: "auto" },
  entree: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: couleurs.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.line,
  },
  entreeTexte: { flex: 1, fontSize: 16, fontWeight: "600", color: couleurs.ink },
  secondaireSeul: { backgroundColor: couleurs.surface, borderWidth: 1, borderColor: couleurs.line, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  secondaireTexte: { color: couleurs.ink, fontSize: 16, fontWeight: "600" },
});
