import { test } from "node:test";
import assert from "node:assert/strict";
import { messageErreurAuth } from "../src/lib/erreurs-auth.ts";
import { LONGUEUR_MIN_MOT_DE_PASSE } from "../src/lib/password.ts";

/* Les messages sont ceux que Supabase a réellement renvoyés le 2026-10-22
   (journaux d'authentification), et que le site traduisait mal. */

test("la longueur exigée se lit dans la réponse de Supabase, pas dans le site", () => {
  assert.equal(
    messageErreurAuth("Password should be at least 10 characters."),
    "Mot de passe trop court : 10 caractères minimum, dont un chiffre.",
  );
  // Si le réglage change encore, le message suit sans toucher au code.
  assert.equal(
    messageErreurAuth("Password should be at least 12 characters."),
    "Mot de passe trop court : 12 caractères minimum, dont un chiffre.",
  );
});

test("le site exige la même longueur que Supabase", () => {
  assert.equal(LONGUEUR_MIN_MOT_DE_PASSE, 10);
});

test("« attendez N secondes » dit combien de temps attendre", () => {
  assert.equal(
    messageErreurAuth("For security purposes, you can only request this after 39 seconds."),
    "Trop d'essais. Réessayez dans 39 secondes.",
  );
});

test("les refus déjà traduits le restent", () => {
  assert.equal(messageErreurAuth("Invalid login credentials"), "Email ou mot de passe incorrect.");
  assert.match(messageErreurAuth("Email not confirmed"), /pas encore confirmé/);
  assert.match(messageErreurAuth("User is banned"), /supprimé ou fermé/);
});

test("un refus inconnu garde le message générique, sans anglais", () => {
  const avant = console.error;
  console.error = () => {};
  try {
    assert.equal(messageErreurAuth("Something new happened"), "Une erreur est survenue. Réessayez.");
  } finally {
    console.error = avant;
  }
});

test("le mot de passe exige un chiffre, pas seulement des lettres", async () => {
  const { erreurNouveauMotDePasse } = await import("../src/lib/password.ts");
  assert.equal(erreurNouveauMotDePasse("seulementdeslettres", "seulementdeslettres"), "Ajoutez au moins un chiffre au mot de passe.");
  assert.equal(erreurNouveauMotDePasse("lettres2026", "lettres2026"), null);
  assert.match(erreurNouveauMotDePasse("court1", "court1") ?? "", /10 caractères minimum, dont un chiffre/);
});
