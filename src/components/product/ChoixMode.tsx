"use client";

import { useState } from "react";
import { Field, Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { CategoryOption } from "@/lib/data/reference";
import { COULEURS, FAMILLES, GENRES, groupesDeTailles, TAILLE_UNIQUE } from "@/lib/mode";

const tailleExclusive = (t: string) => t === TAILLE_UNIQUE;

/**
 * Catégorie, genre, tailles et couleurs d'un produit (la mode, 0074).
 * Les tailles proposées suivent le RAYON de la catégorie choisie : des
 * pointures pour les chaussures, S-M-L pour les vêtements. Une taille
 * cochée puis cachée par un changement de catégorie n'est pas envoyée.
 */

const PASTILLE =
  "relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium";
const ACTIVE = "border-ink bg-ink text-paper";
const INACTIVE = "border-line bg-surface text-ink";

export function ChoixMode({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  initial?: { categoryId: number | null; genre: string | null; tailles: string[]; couleurs: string[] };
}) {
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ? String(initial.categoryId) : "");
  const [genre, setGenre] = useState(initial?.genre ?? "");
  const [tailles, setTailles] = useState<string[]>(initial?.tailles ?? []);
  const [couleurs, setCouleurs] = useState<string[]>(initial?.couleurs ?? []);

  const categorie = categories.find((c) => String(c.id) === categoryId);
  /* Les tailles en groupes titrés (`groupesDeTailles`) : âges pour un
     enfant ; lettres, et tour de taille chiffré pour un bas, pour un adulte. */
  const groupes = categorie ? groupesDeTailles(categorie.famille, genre, categorie.slug) : [];
  // Seules les tailles affichées comptent : une taille cochée puis cachée
  // par un changement de catégorie n'est pas envoyée et ne bloque rien.
  const visibles = groupes.flatMap((g) => g.tailles);
  const cochees = tailles.filter((t) => visibles.includes(t));
  const basculer = (liste: string[], valeur: string) =>
    liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];

  return (
    <>
      <Field label="Catégorie" htmlFor="categoryId">
        <Select id="categoryId" name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="" disabled>
            Choisir une catégorie
          </option>
          {FAMILLES.map((f) => (
            <optgroup key={f.valeur} label={f.libelle}>
              {categories
                .filter((c) => c.famille === f.valeur)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-ink-soft">Pour qui</legend>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => (
            <label key={g.valeur} className={cn(PASTILLE, genre === g.valeur ? ACTIVE : INACTIVE)}>
              <input
                type="radio"
                name="genre"
                value={g.valeur}
                checked={genre === g.valeur}
                onChange={() => setGenre(g.valeur)}
                className="sr-only"
              />
              {g.libelle}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-ink-soft">Tailles disponibles</legend>
        <p className="-mt-1 text-xs text-ink-soft">Cochez toutes celles que vous avez.</p>
        {groupes.length === 0 ? (
          <p className="text-xs text-ink-soft">Choisissez d&apos;abord une catégorie.</p>
        ) : (
          groupes.map((g) => (
            <div key={g.titre} className="flex flex-col gap-1.5 pt-1">
              {groupes.length > 1 ? <span className="text-xs font-semibold text-ink-soft">{g.titre}</span> : null}
              {/* Une ligne par groupe, qui défile de côté (demande du porteur du
                  projet, 2026-11-10) : 19 tours de taille tiennent sur une
                  ligne au lieu de trois. Le dernier bouton dépasse du bord,
                  ce qui montre qu'on peut faire défiler. `relative` sur chaque
                  bouton (PASTILLE) : sans lui, les cases invisibles
                  (`sr-only`, en position absolue) sortaient de la ligne et
                  élargissaient toute la page (constaté, 954 px). */}
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
                {g.tailles.map((t) => {
                  const coche = tailles.includes(t);
                  /* « Taille unique » exclut toute autre taille (décision du
                     porteur du projet, 2026-11-13) : cochée, les autres ne se
                     cochent plus ; une autre cochée, elle ne se coche plus.
                     Une case DÉJÀ cochée reste décochable, pour qu'un ancien
                     produit qui a les deux puisse être corrigé. */
                  const bloquee = !coche && cochees.some((x) => tailleExclusive(x) !== tailleExclusive(t));
                  return (
                    <label
                      key={t}
                      className={cn(PASTILLE, coche ? ACTIVE : INACTIVE, bloquee && "cursor-not-allowed opacity-40")}
                    >
                      <input
                        type="checkbox"
                        name="tailles"
                        value={t}
                        checked={coche}
                        disabled={bloquee}
                        onChange={() => setTailles((l) => basculer(l, t))}
                        className="sr-only"
                      />
                      {t}
                    </label>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-ink-soft">Couleurs disponibles</legend>
        <p className="-mt-1 text-xs text-ink-soft">Cochez toutes celles que vous avez.</p>
        {/* Une seule ligne qui défile : trois couleurs visibles et la
            quatrième à moitié, pour montrer qu'il y a une suite (demande du
            porteur du projet, 2026-11-11). Plusieurs se cochent. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
          {COULEURS.map((c) => {
            const coche = couleurs.includes(c.nom);
            return (
              <label
                key={c.nom}
                className={cn(PASTILLE, "basis-[calc((100%-1.5rem)/3.5)] justify-center px-2", coche ? ACTIVE : INACTIVE)}
              >
                <input
                  type="checkbox"
                  name="couleurs"
                  value={c.nom}
                  checked={coche}
                  onChange={() => setCouleurs((l) => basculer(l, c.nom))}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className="size-3.5 shrink-0 rounded-full border border-line"
                  style={{ background: c.teinte }}
                />
                <span className="truncate">{c.nom}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
