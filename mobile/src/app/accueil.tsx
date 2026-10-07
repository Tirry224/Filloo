import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import { couleurs } from "../theme";

type Profil = { id: string; role: "client" | "merchant"; full_name: string | null };

/**
 * Écran provisoire : il prouve que la connexion à la même base que le site
 * marche, en lisant les comptes de la personne connectée (RLS compris).
 * Il sera remplacé par les vrais parcours.
 */
export default function Accueil() {
  const { session } = useSession();
  const [profils, setProfils] = useState<Profil[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("auth_user_id", session.user.id)
      .then(({ data, error }) => {
        if (error) setErreur("Impossible de lire vos comptes. Réessayez dans un instant.");
        else setProfils(data);
      });
  }, [session]);

  if (!session) return <Redirect href="/connexion" />;

  async function seDeconnecter() {
    await supabase.auth.signOut();
    router.replace("/connexion");
  }

  return (
    <SafeAreaView style={styles.page}>
      <Text style={styles.titre}>Bonjour</Text>
      <Text style={styles.texte}>{session.user.email}</Text>

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
      {profils?.map((p) => (
        <View key={p.id} style={styles.carte}>
          <Text style={styles.texte}>{p.full_name ?? "Sans nom"}</Text>
          <Text style={styles.role}>{p.role === "merchant" ? "Compte commerçant" : "Compte client"}</Text>
        </View>
      ))}

      <Pressable onPress={seDeconnecter} style={styles.bouton}>
        <Text style={styles.texteBouton}>Se déconnecter</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper, padding: 16, gap: 12 },
  titre: { fontSize: 28, fontWeight: "800", color: couleurs.ink },
  texte: { fontSize: 16, color: couleurs.ink },
  role: { fontSize: 14, color: couleurs.inkSoft },
  erreur: { fontSize: 14, color: couleurs.danger },
  carte: { backgroundColor: couleurs.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: couleurs.line, gap: 4 },
  bouton: { borderWidth: 1, borderColor: couleurs.line, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: "auto" },
  texteBouton: { color: couleurs.ink, fontSize: 16, fontWeight: "600" },
});
