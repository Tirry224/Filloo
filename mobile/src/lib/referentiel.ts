import { useEffect, useState } from "react";
import { VILLE_PAR_DEFAUT, lireCategories, lireVilleDuCompte, lireVilles, type Option } from "./catalogue";
import { useSession } from "./session";

/**
 * Villes, catégories et ville de départ (celle du compte client, sinon
 * Conakry), partagées par l'accueil et la recherche. `villeParDefaut` vaut
 * `null` tant que rien n'est chargé : attendre la session évite de partir
 * sur Conakry puis de sauter vers la ville du compte.
 */
export function useReferentiel() {
  const { session, chargement } = useSession();
  const [villes, setVilles] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [villeParDefaut, setVilleParDefaut] = useState<number | null>(null);
  const [erreur, setErreur] = useState(false);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    if (chargement) return;
    setErreur(false);
    Promise.all([lireVilles(), lireCategories(), lireVilleDuCompte(session?.user.id)])
      .then(([v, c, villeDuCompte]) => {
        setVilles(v);
        setCategories(c);
        const depart = v.find((x) => x.id === villeDuCompte) ?? v.find((x) => x.name === VILLE_PAR_DEFAUT) ?? v[0];
        setVilleParDefaut(depart?.id ?? null);
      })
      .catch(() => setErreur(true));
  }, [chargement, session?.user.id, essai]);

  return { villes, categories, villeParDefaut, erreur, reessayer: () => setEssai((n) => n + 1) };
}
