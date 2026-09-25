import { test } from "node:test";
import assert from "node:assert/strict";
import { lirePrixGnf, PRIX_MAX_GNF } from "../src/lib/prix.ts";

/**
 * Chaque cas ici a été trouvé en tapant n'importe quoi dans le champ
 * Prix : avant `lirePrixGnf`, le serveur lisait la saisie avec `Number()`.
 */

test("un prix s'écrit de toutes les façons d'un commerçant, pour le même montant", () => {
  for (const ecriture of [
    "450000",
    "450 000", // l'exemple affiché dans le champ, refusé avant
    "450 000",
    "450 000",
    "450.000", // lu 450 avant : le prix divisé par mille, sans un mot
    "450,000",
    "450 000 GNF",
    "450000fg",
    "  450000  ",
  ]) {
    assert.deepEqual(lirePrixGnf(ecriture), { prix: 450000 }, ecriture);
  }
  assert.deepEqual(lirePrixGnf("1.500.000"), { prix: 1500000 });
  assert.deepEqual(lirePrixGnf("0"), { prix: 0 });
});

test("un champ vide n'est pas un produit gratuit", () => {
  // `Number("")` valait 0, et 0 était accepté.
  for (const vide of ["", "   ", "GNF"]) {
    assert.ok("erreur" in lirePrixGnf(vide), JSON.stringify(vide));
  }
});

test("ce qui n'est pas un montant en francs entiers est refusé avec un message", () => {
  for (const faux of [
    "1,5", "1.5", "45.00", "1.500,000", // décimaux ou séparateurs mélangés
    "1e6", "0x1F4", "Infinity", "-500", "cinq cents", "١٢٣", "450 000 $",
  ]) {
    const lu = lirePrixGnf(faux);
    assert.ok("erreur" in lu && lu.erreur.length > 0, faux);
  }
});

test("un montant que JavaScript arrondirait est refusé plutôt que modifié", () => {
  assert.ok("erreur" in lirePrixGnf("99999999999999999999"));
  assert.ok("erreur" in lirePrixGnf(String(Number.MAX_SAFE_INTEGER)));
});

test("au-delà de dix milliards de francs, c'est une faute de frappe", () => {
  // 9 007 199 254 740 991 GNF passait et débordait de la fiche produit
  // (2026-09-25). Dix milliards couvrent un terrain ou un camion.
  assert.deepEqual(lirePrixGnf("10 000 000 000"), { prix: PRIX_MAX_GNF });
  assert.ok("erreur" in lirePrixGnf("10 000 000 001"));
});
