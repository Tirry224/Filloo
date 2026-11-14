import { test } from "node:test";
import assert from "node:assert/strict";
import { decouperLiens, lienInterne } from "../src/lib/liens.ts";

/* Un lien reçu dans la messagerie restait du texte (porteur du projet,
   2026-11-14). Ces cas fixent ce qui devient cliquable, et ce qui ne
   doit JAMAIS l'être. */

const liens = (texte: string) => decouperLiens(texte).filter((m) => m.lien).map((m) => m.lien);

test("un lien http(s) devient cliquable, le texte autour reste", () => {
  assert.deepEqual(decouperLiens("Voici https://filloo.net/produit/abc merci"), [
    { texte: "Voici " },
    { texte: "https://filloo.net/produit/abc", lien: "https://filloo.net/produit/abc" },
    { texte: " merci" },
  ]);
});

test("www. sans protocole s'ouvre en https", () => {
  assert.deepEqual(liens("va sur www.exemple.com"), ["https://www.exemple.com/"]);
});

test("la ponctuation de fin de phrase reste hors du lien", () => {
  assert.deepEqual(liens("Regarde https://exemple.com/a."), ["https://exemple.com/a"]);
  assert.deepEqual(liens("(voir https://exemple.com/a)"), ["https://exemple.com/a"]);
  assert.deepEqual(liens("https://fr.wikipedia.org/wiki/Conakry_(ville)"), ["https://fr.wikipedia.org/wiki/Conakry_(ville)"]);
  const texte = "Regarde https://exemple.com/a, puis réponds.";
  assert.equal(decouperLiens(texte).map((m) => m.texte).join(""), texte);
});

test("rien de dangereux ni de faux positif", () => {
  assert.deepEqual(liens("javascript:alert(1)"), []);
  assert.deepEqual(liens("data:text/html,<b>x</b>"), []);
  assert.deepEqual(liens("Prix 3.5 millions, fin.Merci"), []);
  assert.deepEqual(liens("Pas de lien ici"), []);
  assert.deepEqual(decouperLiens(""), []);
});

test("un lien Filloo reste dans l'onglet, les autres non", () => {
  assert.equal(lienInterne("https://filloo.net/produit/x"), true);
  assert.equal(lienInterne("https://www.filloo.net/"), true);
  assert.equal(lienInterne("https://filloo.net.pirate.com/"), false);
  assert.equal(lienInterne("https://exemple.com/"), false);
});
