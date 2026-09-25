import { test, expect } from "@playwright/test";

test("l’accueil s’ouvre sans compte", async ({ page }) => {
  const r = await page.goto("/");
  expect(r?.status()).toBe(200);
});

for (const chemin of ["/messages", "/compte/informations", "/vendeur", "/vendeur/produits/nouveau"]) {
  test(`${chemin} renvoie un visiteur à la connexion, et l’y ramène ensuite`, async ({ page }) => {
    await page.goto(chemin);
    await expect(page).toHaveURL(`/connexion?next=${encodeURIComponent(chemin)}`);
  });
}

test("une connexion avec un mauvais mot de passe est refusée", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill("personne@exemple.com");
  await page.getByLabel("Mot de passe").fill("mauvais-mdp-123");
  await page.getByRole("button", { name: /connecter/i }).click();
  await expect(page.locator("p.text-danger, [role=alert]").first()).toBeVisible();
  await expect(page).toHaveURL(/\/connexion/);
});

test("deux mots de passe différents bloquent l’inscription", async ({ page }) => {
  await page.goto("/inscription");
  await page.getByLabel("Nom complet").fill("Test Différent");
  await page.getByLabel("Téléphone").fill("620000001");
  await page.getByLabel("Email").fill(`diff-${Date.now()}@exemple.com`);
  await page.getByLabel("Mot de passe", { exact: true }).fill("motdepasse1");
  await page.getByLabel("Confirmer le mot de passe").fill("motdepasse2");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.locator("p.text-danger").first()).toBeVisible();
  await expect(page).toHaveURL(/\/inscription/);
});

test("une page inconnue répond 404", async ({ page }) => {
  const r = await page.goto("/cette-page-n-existe-pas");
  expect(r?.status()).toBe(404);
});
