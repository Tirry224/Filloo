import { test } from "node:test";
import assert from "node:assert/strict";
import { estFiltree, jsonLd } from "../src/lib/seo.ts";

const CLES = ["categorie", "tri"] as const;

test("l'accueil nu reste indexable", () => {
  assert.equal(estFiltree({}, CLES), false);
});

test("un paramètre de suivi ne retire pas la page de Google", () => {
  assert.equal(estFiltree({ fbclid: "abc" }, CLES), false);
  assert.equal(estFiltree({ utm_source: "whatsapp", gclid: "x" }, CLES), false);
  assert.equal(estFiltree({ _vercel_share: "tok" }, CLES), false);
});

test("un filtre vide ne compte pas", () => {
  assert.equal(estFiltree({ categorie: "" }, CLES), false);
  assert.equal(estFiltree({ categorie: "  " }, CLES), false);
  assert.equal(estFiltree({ categorie: [""] }, CLES), false);
});

test("un vrai filtre retire la variante de l'index", () => {
  assert.equal(estFiltree({ categorie: "Électronique" }, CLES), true);
  assert.equal(estFiltree({ tri: "recent", fbclid: "abc" }, CLES), true);
  assert.equal(estFiltree({ categorie: ["", "Beauté"] }, CLES), true);
});

test("jsonLd ne laisse pas un texte fermer la balise script", () => {
  const sortie = jsonLd({ name: "</script><script>alert(1)</script>" });
  assert.ok(!sortie.includes("<"));
  assert.deepEqual(JSON.parse(sortie), { name: "</script><script>alert(1)</script>" });
});
