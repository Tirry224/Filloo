import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../lib/session";
import { supabase } from "../../lib/supabase";
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

      <Pressable onPress={() => supabase.auth.signOut()} style={[styles.bouton, styles.secondaire]}>
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
  secondaireSeul: { backgroundColor: couleurs.surface, borderWidth: 1, borderColor: couleurs.line, borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  secondaireTexte: { color: couleurs.ink, fontSize: 16, fontWeight: "600" },
});
