import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../src/lib/next-param.ts";

/**
 * `safeNextPath` est le SEUL endroit qui décide si une adresse de reprise
 * est sûre. Tout le reste de l'application lui fait confiance : les
 * formulaires de connexion et d'inscription, `/auth/confirm`, et depuis
 * aujourd'hui le parcours « mot de passe oublié ». Une faille ici est une
 * redirection ouverte vers un site d'hameçonnage portant notre nom.
 *
 * POURQUOI CE FICHIER EXISTE. Les quinze cas qui ont trouvé le
 * contournement par tabulation ont été exécutés depuis `/tmp` et n'ont
 * jamais été versionnés : le défaut pouvait donc revenir sans que rien ne
 * le dise. Ils sont ici, dans le dépôt, avec ceux qui manquaient.
 *
 * Le contournement, pour mémoire : `safeNextPath` comparait des préfixes,
 * donc `//autre.gn` était refusé — mais `/<TAB>/faux-filloo.gn` passait,
 * et les navigateurs effacent les tabulations AVANT d'analyser l'adresse,
 * qui redevenait `//faux-filloo.gn`. Une liste blanche qui compare des
 * préfixes valide une ORTHOGRAPHE, pas une adresse.
 *
 *     node --run tests
 */

test("un chemin interne ordinaire passe", () => {
  assert.equal(safeNextPath("/produit/abc"), "/produit/abc");
  assert.equal(safeNextPath("/"), "/");
});

test("la chaîne de requête et le fragment sont conservés", () => {
  // Ils portent l'intention : `?produit=` cité dans un fil, par exemple.
  assert.equal(safeNextPath("/messages/1?produit=42"), "/messages/1?produit=42");
  assert.equal(safeNextPath("/recherche?q=riz#resultats"), "/recherche?q=riz#resultats");
});

test("une adresse absolue est refusée, quel que soit le protocole", () => {
  for (const hostile of [
    "https://faux-filloo.gn",
    "http://faux-filloo.gn",
    "//faux-filloo.gn",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "mailto:quelquun@exemple.gn",
  ]) {
    assert.equal(safeNextPath(hostile), null, `accepté à tort : ${hostile}`);
  }
});

test("LE CAS QUI A COÛTÉ CHER : un caractère de contrôle en deuxième position", () => {
  /* Le navigateur efface ces caractères puis relit l'adresse : ce qui
     ressemble à un chemin interne redevient `//faux-filloo.gn`. */
  for (const controle of ["\t", "\n", "\r", "\u0000", "\u001F", "\u007F"]) {
    const hostile = `/${controle}/faux-filloo.gn`;
    assert.equal(safeNextPath(hostile), null, `accepté à tort : ${JSON.stringify(hostile)}`);
  }
});

test("un caractère de contrôle AU MILIEU est refusé, en fin de chaîne il est rogné", () => {
  /* La règle porte sur toute la chaîne, pas seulement sur son début : le
     motif exact ne se devine pas, donc aucune position n'est tolérée. */
  assert.equal(safeNextPath("/produit/\tabc"), null);

  /* MAIS un caractère de contrôle en BORD est retiré par le `trim()` qui
     précède le contrôle, et ce qui reste — `/produit/abc` — est un chemin
     parfaitement sûr. Le refuser n'apporterait aucune sécurité et
     casserait une adresse valable recopiée avec un saut de ligne.
     Cette ligne a d'abord été écrite en attendant `null` : c'est le test
     qui s'était trompé, pas la fonction. */
  assert.equal(safeNextPath("/produit/abc\n"), "/produit/abc");
});

test("une adresse qui ne commence pas par une barre oblique est refusée", () => {
  // Sans cette règle, `produit/abc` se résoudrait relativement à l'écran
  // courant et mènerait ailleurs selon l'endroit d'où l'on vient.
  assert.equal(safeNextPath("produit/abc"), null);
  assert.equal(safeNextPath("../admin"), null);
  assert.equal(safeNextPath(""), null);
});

test("l'adresse de reprise du parcours mot de passe oublié survit à l'aller-retour", () => {
  /* Le chemin traverse deux redirections encodées (`/auth/confirm`, puis
     `/reinitialiser-mot-de-passe`) : ce test fige le fait que la forme
     imbriquée reste acceptable des deux côtés. */
  const intention = "/produit/abc";
  const etape = `/reinitialiser-mot-de-passe?next=${encodeURIComponent(intention)}`;
  assert.equal(safeNextPath(etape), etape);
  assert.equal(safeNextPath(decodeURIComponent(encodeURIComponent(intention))), intention);
});

test("ce qui n'est pas une chaîne est refusé sans lever", () => {
  /* La valeur vient d'un `FormData`, donc elle peut être un fichier, ou
     absente. Une exception ici ferait échouer une connexion par ailleurs
     valide. */
  for (const brut of [null, undefined, 42, {}, [], true]) {
    assert.equal(safeNextPath(brut), null);
  }
});

test("les espaces de bord sont tolérés, pas le reste", () => {
  assert.equal(safeNextPath("  /compte  "), "/compte");
});

test("un chemin traversant ne sort pas du site", () => {
  /* `..` est résolu par l'analyseur d'URL, pas laissé tel quel : ce qui
     sort d'ici est ce que le navigateur aurait compris. */
  const resolu = safeNextPath("/produit/../compte");
  assert.equal(resolu, "/compte");
});
