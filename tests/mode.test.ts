import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COULEURS_MAX,
  garderPermises,
  GENRES_FILTRE,
  lireGenre,
  lireTranchePrix,
  NOMS_COULEURS,
  groupesDeTailles,
  aPlat,
  rangerTailles,
  taillesCompatibles,
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
  for (const famille of ["vetements", "chaussures", "accessoires"] as const) {
    for (const genre of ["femme", "homme", "enfant", "mixte", null]) {
      for (const slug of ["pantalons", "robes", null]) {
        const tailles = aPlat(groupesDeTailles(famille, genre, slug));
        assert.ok(tailles.length <= TAILLES_MAX, `${famille}/${genre}/${slug} : ${tailles.length}`);
        // Toute taille proposée doit être acceptée par le serveur.
        for (const t of tailles) assert.ok(TOUTES_TAILLES.includes(t), t);
      }
    }
  }
  assert.ok(NOMS_COULEURS.length <= COULEURS_MAX);
});

test("les tranches de prix se suivent sans trou", () => {
  for (let i = 1; i < TRANCHES_PRIX.length; i++) {
    assert.equal(TRANCHES_PRIX[i].min, TRANCHES_PRIX[i - 1].max);
  }
  assert.equal(lireTranchePrix("100k-250k")?.min, 100_000);
  assert.equal(lireTranchePrix("gratuit"), null);
});

test("tailles en groupes : âges pour un enfant, lettres et tour de taille pour un bas adulte", () => {
  const enfant = aPlat(groupesDeTailles("vetements", "enfant", "pantalons"));
  assert.ok(enfant.includes("4 ans") && !enfant.includes("M") && !enfant.includes("30"));
  const jean = groupesDeTailles("vetements", "femme", "pantalons");
  assert.deepEqual(jean.map((g) => g.titre), ["Tailles (S, M, L…)", "Tour de taille (jeans, pantalons)", "Autre"]);
  assert.equal(jean[1].tailles[0], "25");
  // Une robe n'a pas de tour de taille chiffré.
  assert.ok(!aPlat(groupesDeTailles("vetements", "femme", "robes")).includes("30"));
  // Pointures : enfant à part.
  assert.ok(aPlat(groupesDeTailles("chaussures", "enfant")).includes("20"));
  assert.ok(!aPlat(groupesDeTailles("chaussures", "homme")).includes("20"));
});

test("les tailles se lisent du plus petit au plus grand, quel que soit l'ordre coché", () => {
  // Cas constaté en production le 2026-11-13 : 41 et 43 après 44.
  assert.deepEqual(garderPermises(["39", "40", "42", "44", "41", "43"], TOUTES_TAILLES), ["39", "40", "41", "42", "43", "44"]);
  assert.deepEqual(rangerTailles(["Taille unique", "XL", "S", "M"]), ["S", "M", "XL", "Taille unique"]);
  assert.deepEqual(rangerTailles(["10 ans", "2 ans", "6-12 mois"]), ["6-12 mois", "2 ans", "10 ans"]);
  // Une taille inconnue (ancienne) reste, à la fin.
  assert.deepEqual(rangerTailles(["XXXXL", "M"]), ["M", "XXXXL"]);
  // Le filtre de la recherche, sans catégorie : nombres triés, « Taille unique » en dernier.
  const filtre = aPlat([...groupesDeTailles("vetements", "femme", "pantalons"), ...groupesDeTailles("chaussures", "femme")]);
  const nombres = filtre.filter((t) => /^\d+$/.test(t)).map(Number);
  assert.deepEqual(nombres, [...nombres].sort((a, b) => a - b));
  assert.equal(filtre.at(-1), "Taille unique");
  // Toute la liste de référence est elle-même rangée.
  assert.deepEqual(rangerTailles(TOUTES_TAILLES), [...TOUTES_TAILLES]);
});

test("« Taille unique » exclut toute autre taille", () => {
  assert.ok(taillesCompatibles(["Taille unique"]));
  assert.ok(taillesCompatibles(["S", "M"]));
  assert.ok(!taillesCompatibles(["XS", "Taille unique"]));
});
