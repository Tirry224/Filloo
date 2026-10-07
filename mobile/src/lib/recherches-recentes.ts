import AsyncStorage from "@react-native-async-storage/async-storage";

/** Les cinq dernières recherches, gardées sur le téléphone seulement (comme `localStorage` sur le site). */
const CLE = "filloo.recherches";
const MAX = 5;

export async function lireRecherches(): Promise<string[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    const liste: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste.filter((v): v is string => typeof v === "string") : [];
  } catch {
    // Stockage illisible : pas d'historique, mais pas d'écran cassé.
    return [];
  }
}

export async function retenirRecherche(terme: string): Promise<string[]> {
  const propre = terme.trim();
  const avant = await lireRecherches();
  if (!propre) return avant;
  const liste = [propre, ...avant.filter((r) => r !== propre)].slice(0, MAX);
  try {
    await AsyncStorage.setItem(CLE, JSON.stringify(liste));
  } catch {}
  return liste;
}

export async function effacerRecherches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLE);
  } catch {}
}
