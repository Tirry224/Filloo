import { Badge } from "@/components/ui/Badge";
import type { AnnonceAdmin } from "@/lib/data/equipe";

/** L'état d'une annonce, en clair et en couleur. */
export function EtatAnnonce({ etat }: { etat: AnnonceAdmin["etat"] }) {
  if (etat === "brouillon") return <Badge tone="neutral">Brouillon</Badge>;
  if (etat === "programmee") return <Badge tone="warn">Programmée</Badge>;
  if (etat === "publiee") return <Badge tone="success">Publiée</Badge>;
  return <Badge tone="danger">Retirée</Badge>;
}

/** « jeu. 6 nov. » — Conakry vit en UTC. */
export function jour(iso: string): string {
  const date = iso.length === 10 ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** « 6 nov. à 14:05 » */
export function jourEtHeure(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })} à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`;
}

/** La date minimale d'une programmation : demain (le cron passe à 7 h, le jour même serait trop tard). */
export function demain(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
