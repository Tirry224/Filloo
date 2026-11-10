import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COULEURS_MAX,
  garderPermises,
  GENRES_FILTRE,
  lireGenre,
  lireTranchePrix,
  NOMS_COULEURS,
  TAILLES,
  TAILLES_MAX,
  TOUTES_TAILLES,
  TRANCHES_PRIX,
} from "../src/lib/mode.ts";

test("un genre forgé n'est pas lu", () => {
  assert.equal(lireGenre("femme"), "femme");
  assert.equal(lireGenre("mixte"), "mixte");
  assert.equal(lireGenre("Femme"), null);
  assert.equal(lireGenre("autre"), null);
  assert.equal(lireGenre(null), null);
});

test("« Mixte » n'est pas un filtre : il sort sous Femme et Homme", () => {
  assert.deepEqual(GENRES_FILTRE.map((g) => g.valeur), ["femme", "homme", "enfant"]);
});

test("une saisie multiple ne garde que les valeurs permises, sans doublon, dans l'ordre de la liste", () => {
  assert.deepEqual(garderPermises(["L", "S", "L", "<script>", "99"], TOUTES_TAILLES), ["S", "L"]);
  assert.deepEqual(garderPermises([], NOMS_COULEURS), []);
});

test("les listes tiennent dans les bornes de la base (0074)", () => {
  // Un produit qui coche tout doit encore passer la contrainte de cardinalité.
  for (const tailles of Object.values(TAILLES)) assert.ok(tailles.length <= TAILLES_MAX);
  assert.ok(NOMS_COULEURS.length <= COULEURS_MAX);
});

test("les tranches de prix se suivent sans trou", () => {
  for (let i = 1; i < TRANCHES_PRIX.length; i++) {
    assert.equal(TRANCHES_PRIX[i].min, TRANCHES_PRIX[i - 1].max);
  }
  assert.equal(lireTranchePrix("100k-250k")?.min, 100_000);
  assert.equal(lireTranchePrix("gratuit"), null);
});
