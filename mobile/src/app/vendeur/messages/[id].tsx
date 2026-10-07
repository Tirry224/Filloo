import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { EcranFil } from "../../../composants/EcranFil";
import { useCommercant } from "../../../lib/contexte-commercant";

/** Un fil vu depuis l'espace commerçant : j'y écris en tant que ma boutique. */
export default function FilCommercant() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { compte } = useCommercant();
  const moi = useMemo(() => ({ id: compte.profilId, suspendu: compte.suspendu }), [compte.profilId, compte.suspendu]);
  return <EcranFil id={id} moi={moi} pret espace="merchant" />;
}
