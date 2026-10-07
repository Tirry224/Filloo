import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { lireVilles, type Option } from "../lib/catalogue";
import { ADRESSE_MAX, DESCRIPTION_MAX, NOM_MAX, type SaisieBoutique } from "../lib/edition-boutique";
import { couleurs } from "../theme";
import { FeuilleChoix } from "./FeuilleChoix";

/** Les champs d'une boutique, communs à la création et à la modification (`ShopSignupForm` du site). */
export function ChampsBoutique({
  saisie,
  onChange,
  creation = false,
}: {
  saisie: SaisieBoutique;
  onChange: (s: SaisieBoutique) => void;
  /** À la création seulement, un WhatsApp vide reprend le numéro du compte. */
  creation?: boolean;
}) {
  const [villes, setVilles] = useState<Option[]>([]);
  const [choixVille, setChoixVille] = useState(false);
  const maj = (champ: Partial<SaisieBoutique>) => onChange({ ...saisie, ...champ });

  useEffect(() => {
    lireVilles().then(setVilles).catch(() => {});
  }, []);

  const ville = villes.find((v) => v.id === saisie.villeId)?.name;

  return (
    <>
      <Champ libelle="Nom de la boutique" value={saisie.nom} onChangeText={(nom) => maj({ nom })} placeholder="Nom de votre boutique" maxLength={NOM_MAX} />

      <Text style={styles.libelle}>Ville</Text>
      <Pressable style={[styles.champ, styles.selecteur]} onPress={() => setChoixVille(true)}>
        <Text style={{ fontSize: 16, color: ville ? couleurs.ink : couleurs.inkSoft }}>{ville ?? "Choisir"}</Text>
        <Ionicons name="chevron-down" size={18} color={couleurs.inkSoft} />
      </Pressable>

      <Champ
        libelle="Où vous trouver"
        aide="Facultatif"
        value={saisie.adresse}
        onChangeText={(adresse) => maj({ adresse })}
        placeholder="Quartier, marché ou point de repère"
        maxLength={ADRESSE_MAX}
      />
      <Champ
        libelle="Numéro WhatsApp"
        aide={creation ? "Facultatif — sinon celui de votre compte" : "Facultatif"}
        value={saisie.whatsapp}
        onChangeText={(whatsapp) => maj({ whatsapp })}
        placeholder="622 33 44 55"
        keyboardType="phone-pad"
      />
      <Champ
        libelle="Que vendez-vous ?"
        aide="Facultatif"
        value={saisie.description}
        onChangeText={(description) => maj({ description })}
        placeholder="Ce que vend votre boutique…"
        multiline
        maxLength={DESCRIPTION_MAX}
        style={[styles.champ, { minHeight: 90, textAlignVertical: "top" }]}
      />

      <FeuilleChoix
        titre="Ville"
        visible={choixVille}
        choix={villes.map((v) => ({ libelle: v.name, valeur: v.id as number | null }))}
        actuel={saisie.villeId}
        onChoisir={(villeId) => maj({ villeId })}
        onFermer={() => setChoixVille(false)}
      />
    </>
  );
}

export function Champ({ libelle, aide, style, ...props }: { libelle: string; aide?: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.libelle}>
        {libelle} {aide ? <Text style={styles.aide}>({aide})</Text> : null}
      </Text>
      <TextInput style={style ?? styles.champ} placeholderTextColor={couleurs.inkSoft} {...props} />
    </View>
  );
}

export const styles = StyleSheet.create({
  libelle: { fontSize: 14, fontWeight: "600", color: couleurs.ink, marginTop: 8 },
  aide: { fontWeight: "400", color: couleurs.inkSoft },
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
});
