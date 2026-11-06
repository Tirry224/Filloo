import { Badge } from "@/components/ui/Badge";
import type { EtatCampagne as Etat } from "@/lib/data/publicite";

const ETATS: Record<Etat, { libelle: string; ton: "neutral" | "accent" | "success" | "warn" | "danger" }> = {
  en_attente: { libelle: "En attente", ton: "warn" },
  active: { libelle: "Active", ton: "success" },
  terminee: { libelle: "Terminée", ton: "neutral" },
  refusee: { libelle: "Refusée", ton: "danger" },
  annulee: { libelle: "Annulée", ton: "neutral" },
  interrompue: { libelle: "Interrompue", ton: "danger" },
};

export function EtatCampagne({ etat }: { etat: Etat }) {
  const { libelle, ton } = ETATS[etat];
  return <Badge tone={ton}>{libelle}</Badge>;
}

/** Le taux de clics, en clair ; rien tant qu'il n'y a pas eu d'affichage. */
export function tauxDeClics(vues: number, clics: number): string {
  return vues ? `${((clics / vues) * 100).toFixed(1).replace(".", ",")} %` : "—";
}
