import Link from "next/link";
import { Search, X } from "lucide-react";

/**
 * Barre de recherche d'un onglet de `/admin` (Messages, Publicité) : un
 * formulaire GET, la recherche vit dans l'adresse (`?q=`) et survit au
 * retour arrière.
 */
export function RechercheListe({ action, valeur, placeholder }: { action: string; valeur: string; placeholder: string }) {
  return (
    <form action={action} method="get" role="search" className="flex gap-2">
      <label className="sr-only" htmlFor="q">
        Rechercher
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={valeur}
        placeholder={placeholder}
        maxLength={80}
        className="h-tap w-full rounded-lg border border-line bg-surface px-3.5 text-base"
      />
      {valeur ? (
        <Link href={action} aria-label="Effacer la recherche" className="flex size-tap shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft">
          <X size={20} strokeWidth={2.2} aria-hidden />
        </Link>
      ) : null}
      <button type="submit" aria-label="Rechercher" className="flex size-tap shrink-0 cursor-pointer items-center justify-center rounded-lg bg-accent text-white">
        <Search size={20} strokeWidth={2.2} aria-hidden />
      </button>
    </form>
  );
}
