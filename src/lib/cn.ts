import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Assemble des classes CSS : `clsx` accepte conditions, tableaux et
 * valeurs nulles ; `twMerge` tranche les conflits Tailwind.
 *
 * Sans `twMerge`, `bg-accent` posée par le composant et `bg-danger` passée
 * de l'extérieur coexistent, et c'est l'ordre dans la feuille de style —
 * non celui des arguments — qui gagne : le résultat paraît aléatoire.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
