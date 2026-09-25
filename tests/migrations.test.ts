import { test } from "node:test";
import assert from "node:assert/strict";
import { cle, comparerMigrations } from "../scripts/migrations.mjs";

/** La production telle qu'elle était le 2026-09-25 au matin : les
 * premières migrations sans numéro, et 0026 jamais appliquée. */
const production = [
  { version: "20260911054259", name: "0001_schema" },
  { version: "20260911062618", name: "profile_suspension_date" },
  { version: "20260922130058", name: "0025_a_catalogue_without_a_catch_all" },
];
const depot = [
  "0001_schema.sql",
  "0009_profile_suspension_date.sql",
  "0025_a_catalogue_without_a_catch_all.sql",
  "0026_five_photos_per_product.sql",
];

test("une migration perdue en route sans son numéro se retrouve quand même", () => {
  assert.equal(cle("0009_profile_suspension_date.sql"), cle("profile_suspension_date"));
});

test("le trou de 0026 est trouvé", () => {
  const r = comparerMigrations(depot, production);
  assert.deepEqual(r.nonAppliquees, ["0026_five_photos_per_product"]);
  assert.deepEqual(r.nonCommitees, []);
});

test("une migration appliquée au tableau de bord sans être commitée est trouvée", () => {
  const r = comparerMigrations(depot.slice(0, 3), [...production, { version: "20260923000000", name: "faite_a_la_main" }]);
  assert.deepEqual(r.nonCommitees, ["faite_a_la_main"]);
});

test("une migration appliquée après celle qui la suit est signalée", () => {
  const r = comparerMigrations(depot, [
    ...production,
    { version: "20260920000000", name: "0026_five_photos_per_product" },
  ]);
  assert.deepEqual(r.nonAppliquees, []);
  assert.deepEqual(r.horsOrdre, ["0025_a_catalogue_without_a_catch_all"]);
});

test("les fichiers qui ne sont pas du SQL sont ignorés", () => {
  const r = comparerMigrations([...depot, "README.md"], [
    ...production,
    { version: "20260925175219", name: "0026_five_photos_per_product" },
  ]);
  assert.equal(r.total, 4);
  assert.deepEqual(r.nonAppliquees, []);
});
