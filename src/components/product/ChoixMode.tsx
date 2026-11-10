"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Field, Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { CategoryOption } from "@/lib/data/reference";
import { COULEURS, FAMILLES, GENRES, groupesDeTailles } from "@/lib/mode";

/**
 * Catégorie, genre, tailles et couleurs d'un produit (la mode, 0074).
 * Les tailles proposées suivent le RAYON de la catégorie choisie : des
 * pointures pour les chaussures, S-M-L pour les vêtements. Une taille
 * cochée puis cachée par un changement de catégorie n'est pas envoyée.
 */

const PASTILLE =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium";
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

      <fieldset className="flex flex-col gap-1.5">
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

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-ink-soft">Tailles disponibles</legend>
        <p className="-mt-1 text-xs text-ink-soft">Cochez toutes celles que vous avez.</p>
        {groupes.length === 0 ? (
          <p className="text-xs text-ink-soft">Choisissez d&apos;abord une catégorie.</p>
        ) : (
          groupes.map((g) => (
            <div key={g.titre} className="flex flex-col gap-1.5 pt-1">
              {groupes.length > 1 ? <span className="text-xs font-semibold text-ink-soft">{g.titre}</span> : null}
              <div className="flex flex-wrap gap-2">
                {g.tailles.map((t) => {
                  const coche = tailles.includes(t);
                  return (
                    <label key={t} className={cn(PASTILLE, coche ? ACTIVE : INACTIVE)}>
                      <input
                        type="checkbox"
                        name="tailles"
                        value={t}
                        checked={coche}
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

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-ink-soft">Couleurs disponibles</legend>
        <div className="flex flex-wrap gap-2">
          {COULEURS.map((c) => {
            const coche = couleurs.includes(c.nom);
            return (
              <label key={c.nom} className={cn(PASTILLE, coche ? ACTIVE : INACTIVE)}>
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
                {c.nom}
                {coche ? <Check size={14} strokeWidth={2.4} aria-hidden /> : null}
              </label>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
