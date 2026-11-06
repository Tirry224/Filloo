import { test } from "node:test";
import assert from "node:assert/strict";
import { etaler, melanger, suggestions } from "../src/lib/melange.ts";
import { GOUTS_VIDES, lireGouts, nourrirGouts } from "../src/lib/gouts.ts";

const produit = (id: string, category: string, merchant: string, status = "active") => ({
  id,
  category,
  status,
  merchant: { id: merchant },
});

/** Un tirage reproductible : la même suite à chaque test. */
function graine(n: number) {
  return () => {
    n = (n * 16807) % 2147483647;
    return n / 2147483647;
  };
}

const catalogue = Array.from({ length: 40 }, (_, i) =>
  produit(`p${i}`, i % 2 ? "Chaussures" : "Téléphones", `m${i % 5}`),
);

test("le mélange garde tous les produits, une fois chacun", () => {
  const sortie = melanger(catalogue, GOUTS_VIDES, graine(7));
  assert.equal(sortie.length, catalogue.length);
  assert.equal(new Set(sortie.map((p) => p.id)).size, catalogue.length);
});

test("deux affichages ne donnent pas le même ordre", () => {
  const a = melanger(catalogue, GOUTS_VIDES, graine(1)).map((p) => p.id).join();
  const b = melanger(catalogue, GOUTS_VIDES, graine(2)).map((p) => p.id).join();
  assert.notEqual(a, b);
});

test("une catégorie souvent regardée sort plus souvent en tête, sans chasser les autres", () => {
  const gouts = { c: { Chaussures: 10 }, b: {} };
  let enTete = 0;
  let autresVues = 0;
  for (let s = 1; s <= 200; s++) {
    const tete = melanger(catalogue, gouts, graine(s)).slice(0, 10);
    enTete += tete.filter((p) => p.category === "Chaussures").length;
    autresVues += tete.filter((p) => p.category !== "Chaussures").length;
  }
  assert.ok(enTete > autresVues * 2, `${enTete} contre ${autresVues}`);
  assert.ok(autresVues > 0, "les autres catégories doivent rester visibles");
});

test("deux produits de la même boutique ne se suivent pas quand on peut l'éviter", () => {
  const sortie = etaler([produit("a", "x", "m1"), produit("b", "x", "m1"), produit("c", "x", "m2")]);
  assert.deepEqual(sortie.map((p) => p.id), ["a", "c", "b"]);
});

test("un produit vendu passe loin derrière", () => {
  const liste = [produit("vendu", "x", "m1", "sold"), ...catalogue.slice(0, 9)];
  let rangs = 0;
  for (let s = 1; s <= 100; s++) rangs += melanger(liste, GOUTS_VIDES, graine(s)).findIndex((p) => p.id === "vendu");
  assert.ok(rangs / 100 > 6, `rang moyen ${rangs / 100}`);
});

test("les suggestions excluent la fiche elle-même et favorisent sa catégorie", () => {
  const sortie = suggestions(catalogue, { id: "p1", category: "Chaussures" }, GOUTS_VIDES, 6, graine(3));
  assert.equal(sortie.length, 6);
  assert.ok(!sortie.some((p) => p.id === "p1"));
  assert.equal(sortie.filter((p) => p.category === "Chaussures").length, 4);
});

test("un cookie trafiqué vaut « aucun goût »", () => {
  assert.deepEqual(lireGouts("%7Bpas du json"), GOUTS_VIDES);
  assert.deepEqual(lireGouts(encodeURIComponent(JSON.stringify({ c: { x: -3, y: "a" }, b: { pasunuuid: 2 } }))), GOUTS_VIDES);
});

test("les goûts suivent la personne : le récent pèse plus que l'ancien", () => {
  let g = nourrirGouts(GOUTS_VIDES, { categorie: "Ancien" });
  for (let i = 0; i < 5; i++) g = nourrirGouts(g, { categorie: "Récent" });
  assert.ok(g.c["Récent"] > g.c["Ancien"]);
});
