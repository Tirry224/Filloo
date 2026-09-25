import { test } from "node:test";
import assert from "node:assert/strict";
import { erreurNom, estUuid, lireIdEntier, longueur, NOM_MAX, texteNettoye } from "../src/lib/saisie.ts";
import { messagePourErreur } from "../src/lib/erreurs.ts";

/**
 * Chaque cas a été trouvé le 2026-09-25 en tapant n'importe quoi dans
 * l'application ou en forgeant ses formulaires.
 */

test("les caractères invisibles ne comptent pas comme du texte", () => {
  assert.equal(texteNettoye("​​​"), "");
  assert.equal(texteNettoye("  ﻿Riz‍  "), "Riz");
  // U+202E faisait lire « live » là où l'on avait écrit « evil ».
  assert.equal(texteNettoye("‮evil‬"), "evil");
  // L'arabe s'écrit de droite à gauche sans aucun de ces caractères.
  assert.equal(texteNettoye("مرحبا"), "مرحبا");
  assert.equal(texteNettoye(null), "");
});

test("un nom a une longueur de nom", () => {
  assert.equal(erreurNom("Mariama Diallo", "Nom complet"), null);
  assert.ok(erreurNom(".", "Nom complet"));
  assert.ok(erreurNom("A".repeat(NOM_MAX + 1), "Nom complet"));
  // Compté en caractères, comme PostgreSQL : un emoji vaut un.
  assert.equal(longueur("🍚🔥"), 2);
  assert.equal(erreurNom("🍚".repeat(NOM_MAX), "Nom"), null);
});

test("un identifiant d'URL mal formé est refusé avant la base", () => {
  assert.ok(estUuid("7d378f7f-bfc4-41d3-9469-c676ccfc59c5"));
  for (const faux of ["abc", "", "../../vendeur", "\u0000", "7d378f7f-bfc4-41d3-9469-c676ccfc59c5x", undefined, 42]) {
    assert.equal(estUuid(faux), false, String(faux));
  }
});

test("une catégorie ou une ville est un entier strictement positif", () => {
  assert.equal(lireIdEntier("3"), 3);
  for (const faux of ["-3", "1.5", "0", "abc", "", "1e3", "99999999999", null]) {
    assert.equal(lireIdEntier(faux), null, String(faux));
  }
});

test("seuls les refus écrits pour être lus passent tels quels", () => {
  const silence = console.error;
  console.error = () => {};
  try {
    assert.equal(
      messagePourErreur({ code: "P0001", message: "Limite atteinte : 100 messages par jour maximum." }),
      "Limite atteinte : 100 messages par jour maximum.",
    );
    for (const [code, message] of [
      ["23503", 'insert or update on table "products" violates foreign key constraint'],
      ["22P02", 'invalid input syntax for type uuid: "abc"'],
      ["23514", 'new row for relation "messages" violates check constraint'],
      [undefined, "fetch failed"],
    ] as const) {
      const lu = messagePourErreur({ code, message });
      assert.ok(!/violates|invalid|relation|fetch/.test(lu), lu);
    }
  } finally {
    console.error = silence;
  }
});
