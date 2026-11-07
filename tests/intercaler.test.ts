import { test } from "node:test";
import assert from "node:assert/strict";
import { intercaler } from "../src/lib/intercaler.ts";

const libelles = (r: ({ sponsorise: string } | { ordinaire: string })[]) =>
  r.map((x) => ("sponsorise" in x ? `S${x.sponsorise}` : x.ordinaire));

test("un sponsorisé en tête, puis un tous les 4 produits ordinaires", () => {
  const o = Array.from({ length: 10 }, (_, i) => `o${i}`);
  assert.deepEqual(libelles(intercaler(["1", "2", "3"], o)), [
    "S1", "o0", "o1", "o2", "o3", "S2", "o4", "o5", "o6", "o7", "S3", "o8", "o9",
  ]);
});

test("trop peu de produits ordinaires : les sponsorisés restants vont à la fin, aucun ne se perd", () => {
  assert.deepEqual(libelles(intercaler(["1", "2", "3", "4", "5"], ["o0", "o1"])), ["S1", "o0", "o1", "S2", "S3", "S4", "S5"]);
});

test("sans sponsorisé, la liste ordinaire est intacte", () => {
  assert.deepEqual(libelles(intercaler([], ["o0", "o1"])), ["o0", "o1"]);
});
