import { test } from "node:test";
import assert from "node:assert/strict";
import { estProprietaire } from "../src/lib/proprietaire.ts";

const confirme = "2026-09-16T22:04:32Z";

test("le compte OWNER_EMAIL confirmé est reconnu, casse et espaces ignorés", () => {
  process.env.OWNER_EMAIL = " Proprio@Exemple.com ";
  assert.equal(estProprietaire({ email: "proprio@exemple.com", email_confirmed_at: confirme }), true);
});

test("une adresse non confirmée n'est pas le propriétaire", () => {
  process.env.OWNER_EMAIL = "proprio@exemple.com";
  assert.equal(estProprietaire({ email: "proprio@exemple.com", email_confirmed_at: undefined }), false);
});

test("sans OWNER_EMAIL, personne n'est propriétaire", () => {
  delete process.env.OWNER_EMAIL;
  assert.equal(estProprietaire({ email: "proprio@exemple.com", email_confirmed_at: confirme }), false);
});

test("un autre compte, ou personne, n'est pas le propriétaire", () => {
  process.env.OWNER_EMAIL = "proprio@exemple.com";
  assert.equal(estProprietaire({ email: "autre@exemple.com", email_confirmed_at: confirme }), false);
  assert.equal(estProprietaire(null), false);
});

test("un membre de l'équipe n'a que /admin, un client ordinaire non", async () => {
  const { naQueLAdmin, estDeLEquipe } = await import("../src/lib/proprietaire.ts");
  process.env.OWNER_EMAIL = "proprio@exemple.com";
  const membre = { email: "alpha@exemple.com", email_confirmed_at: confirme, app_metadata: { equipe: true } };
  const client = { email: "client@exemple.com", email_confirmed_at: confirme, app_metadata: { provider: "email" } };
  assert.equal(estDeLEquipe(membre), true);
  assert.equal(naQueLAdmin(membre), true);
  assert.equal(naQueLAdmin(client), false);
  // La marque se lit exactement : une chaîne « true » n'est pas une marque.
  assert.equal(naQueLAdmin({ ...client, app_metadata: { equipe: "true" } }), false);
  assert.equal(naQueLAdmin(null), false);
});

test("le porteur du projet n'a que /admin, même sans marque d'équipe", async () => {
  const { naQueLAdmin } = await import("../src/lib/proprietaire.ts");
  process.env.OWNER_EMAIL = "proprio@exemple.com";
  assert.equal(naQueLAdmin({ email: "proprio@exemple.com", email_confirmed_at: confirme, app_metadata: {} }), true);
});
