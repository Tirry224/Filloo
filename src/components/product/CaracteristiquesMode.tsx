import type { Product } from "@/lib/types";
import { COULEURS, libelleGenre } from "@/lib/mode";

/**
 * Catégorie, genre, tailles et couleurs sur la fiche produit (0074). Un
 * produit publié avant la mode n'a ni genre, ni tailles, ni couleurs :
 * la ligne absente ne s'affiche pas, plutôt qu'un « non renseigné ».
 */
export function CaracteristiquesMode({ product }: { product: Product }) {
  const genre = libelleGenre(product.genre);
  const tailles = product.tailles ?? [];
  const couleurs = product.couleurs ?? [];

  const lignes: { libelle: string; contenu: React.ReactNode }[] = [];
  if (product.category) lignes.push({ libelle: "Catégorie", contenu: product.category });
  if (genre) lignes.push({ libelle: "Pour", contenu: genre });
  if (tailles.length > 0) lignes.push({ libelle: "Tailles", contenu: tailles.join(" · ") });
  if (couleurs.length > 0) {
    lignes.push({
      libelle: "Couleurs",
      contenu: (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {couleurs.map((nom) => (
            <span key={nom} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full border border-line"
                style={{ background: COULEURS.find((c) => c.nom === nom)?.teinte }}
              />
              {nom}
            </span>
          ))}
        </span>
      ),
    });
  }
  if (lignes.length === 0) return null;

  return (
    <dl className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3.5 text-sm">
      {lignes.map((l) => (
        <div key={l.libelle} className="flex gap-3">
          <dt className="w-20 shrink-0 text-ink-soft">{l.libelle}</dt>
          <dd className="font-medium text-ink">{l.contenu}</dd>
        </div>
      ))}
    </dl>
  );
}
