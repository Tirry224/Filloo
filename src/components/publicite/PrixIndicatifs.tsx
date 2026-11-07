import { DUREES, TYPES_CAMPAGNE, type Tarifs, type TypeCampagne } from "@/lib/data/publicite";
import { formatGnf } from "@/lib/format";

/** Le rappel de la grille : le prix encaissé est celui du tarif, sauf « Offert ». */
export function PrixIndicatifs({ tarifs }: { tarifs: Tarifs }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-ink-soft">Voir les prix</summary>
      <table className="mt-2 w-full text-left text-sm">
        <thead>
          <tr className="text-2xs text-ink-soft">
            <th className="py-1 font-semibold">Type</th>
            {DUREES.map((d) => (
              <th key={d} className="py-1 font-semibold">
                {d} j
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(Object.keys(TYPES_CAMPAGNE) as TypeCampagne[]).map((t) => (
            <tr key={t} className="border-t border-line">
              <td className="py-1.5 pr-2">{TYPES_CAMPAGNE[t].libelle}</td>
              {DUREES.map((d) => (
                <td key={d} className="py-1.5 pr-1 whitespace-nowrap">
                  {tarifs[t][d] === undefined ? "—" : formatGnf(tarifs[t][d]!)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
