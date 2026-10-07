import { useLocalSearchParams } from "expo-router";
import { EcranFil } from "../../composants/EcranFil";
import { useComptes } from "../../lib/profil";

/** Un fil vu depuis l'espace client. */
export default function FilClient() {
  const { id, produit } = useLocalSearchParams<{ id: string; produit?: string }>();
  const { client, pret } = useComptes();
  return <EcranFil id={id} produitParam={produit} moi={client} pret={pret} espace="client" />;
}
