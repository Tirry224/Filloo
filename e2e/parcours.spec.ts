import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  connecter,
  inscrire,
  PHOTO,
  produitParTitre,
  signalementsEnAttente,
  suspendre,
  unique,
  validerBoutique,
} from "./aide";

/* Un seul récit, dans l'ordre : chaque test part de ce que le précédent a
   laissé en base. Le premier qui échoue arrête les suivants. */
test.describe.configure({ mode: "serial" });

const id = unique();
const V = { nom: `Aïssatou ${id}`, tel: "622334455", email: `vendeur-${id}@exemple.com`, mdp: "motdepasse-v1" };
const C = { nom: `Mariama ${id}`, tel: "620112233", email: `client-${id}@exemple.com`, mdp: "motdepasse-c1" };
const BOUTIQUE = `Chez Aïssatou ${id}`;
const PRODUIT = `Sac de riz ${id}`;
const QUESTION = `Bonjour, le riz est-il disponible ? ${id}`;
const REPONSE = `Oui, il en reste trois. ${id}`;
let produitId = "";

/* Une personne = un contexte de navigateur, donc ses propres cookies. */
const ouverts: BrowserContext[] = [];
async function personne(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext(test.info().project.use);
  ouverts.push(ctx);
  return ctx.newPage();
}
test.afterEach(async () => {
  while (ouverts.length) await ouverts.pop()!.close();
});

test("un commerçant s’inscrit et envoie sa boutique en vérification", async ({ page }) => {
  await inscrire(page, { role: "Vendre", ...V });
  await expect(page).toHaveURL(/\/inscription\/boutique/);
  await page.getByLabel("Nom de la boutique").fill(BOUTIQUE);
  await page.getByLabel("Ville").selectOption({ index: 1 });
  await page.getByLabel("Où vous trouver").fill("Marché de Madina, allée 3");
  await page.getByLabel("Numéro WhatsApp").fill(V.tel);
  await page.getByLabel("Que vendez-vous ?").fill("Alimentation générale");
  await page.getByRole("button", { name: "Envoyer pour vérification" }).click();
  await expect(page).toHaveURL(/\/vendeur/);
  await expect(page.locator("body")).toContainText(/vérification|attente/i);
});

test("avant validation, un produit ne peut être qu’un brouillon", async ({ browser }) => {
  const page = await personne(browser);
  await connecter(page, V.email, V.mdp);
  await page.goto("/vendeur/produits/nouveau");
  await expect(page.getByText("Publication disponible après validation de votre boutique.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publier le produit" })).toHaveCount(0);
});

test("la boutique validée publie un produit avec photo", async ({ browser }) => {
  await validerBoutique(BOUTIQUE);
  const page = await personne(browser);
  await connecter(page, V.email, V.mdp);
  await page.goto("/vendeur/produits/nouveau");
  await page.locator("input[type=file]").setInputFiles(PHOTO);
  await expect(page.locator("input[name=imagePaths]")).toHaveCount(1, { timeout: 20_000 });
  await page.getByLabel("Titre").fill(PRODUIT);
  await page.getByLabel("Catégorie").selectOption({ index: 1 });
  await page.getByLabel("Prix", { exact: true }).fill("450000");
  await page.getByLabel("Description").fill("Riz parfumé importé, retrait au marché.");
  await page.getByRole("button", { name: "Publier le produit" }).click();
  await expect(page).not.toHaveURL(/nouveau/);
  const produits = await produitParTitre(PRODUIT);
  expect(produits).toHaveLength(1);
  expect(produits![0].status).toBe("active");
  produitId = produits![0].id;
});

test("un visiteur trouve le produit sans compte", async ({ browser }) => {
  const page = await personne(browser);
  await page.goto(`/recherche?q=${encodeURIComponent("riz " + id)}`);
  await expect(page.getByText(PRODUIT).first()).toBeVisible();
  await page.goto(`/produit/${produitId}`);
  await expect(page.getByText(PRODUIT).first()).toBeVisible();
  await expect(page.getByText(BOUTIQUE).first()).toBeVisible();
});

test("un client s’inscrit et écrit au commerçant", async ({ browser }) => {
  const page = await personne(browser);
  await inscrire(page, { role: "Acheter", ...C });
  await expect(page).not.toHaveURL(/\/inscription/);
  await page.goto(`/produit/${produitId}`);
  await page.getByRole("link", { name: /contacter|écrire|message/i }).first().click();
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+/);
  await page.getByLabel("Votre message").fill(QUESTION);
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByText(QUESTION)).toBeVisible();
});

test("le commerçant reçoit le message et répond", async ({ browser }) => {
  const page = await personne(browser);
  await connecter(page, V.email, V.mdp);
  await page.goto("/vendeur/messages");
  await page.getByText(C.nom).first().click();
  await expect(page.getByText(QUESTION)).toBeVisible();
  await page.getByLabel("Votre message").fill(REPONSE);
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByText(REPONSE)).toBeVisible();
});

test("le client lit la réponse", async ({ browser }) => {
  const page = await personne(browser);
  await connecter(page, C.email, C.mdp);
  await page.goto("/messages");
  await page.getByText(BOUTIQUE).first().click();
  await expect(page.getByText(REPONSE)).toBeVisible();
});

test("un client ne franchit pas l’espace commerçant", async ({ browser }) => {
  const page = await personne(browser);
  await connecter(page, C.email, C.mdp);
  await page.goto("/vendeur/produits");
  await expect(page).not.toHaveURL(/\/vendeur\/produits/);
});

/* Vérifié par sabotage le 2026-09-25 : sans l'index
   `reports_un_seul_en_attente` (0027), ce test voit 2 signalements. */
test("un client signale le produit, une seule fois", async ({ browser }) => {
  const page = await personne(browser);
  await connecter(page, C.email, C.mdp);
  for (let essai = 0; essai < 2; essai++) {
    await page.goto(`/produit/${produitId}/signaler`);
    await page.locator("input[type=radio]").first().check({ force: true });
    await page.getByRole("button", { name: /signaler|envoyer/i }).click();
    await expect(page).not.toHaveURL(/\/signaler$/);
  }
  await expect.poll(() => signalementsEnAttente(produitId)).toBe(1);
});

test("un client suspendu est arrêté avant d’écrire", async ({ browser }) => {
  await suspendre(C.nom, "client", true);
  try {
    const page = await personne(browser);
    await connecter(page, C.email, C.mdp);
    await page.goto(`/produit/${produitId}/contacter`);
    await expect(page).toHaveURL(/\/compte\/suspendu/);
  } finally {
    await suspendre(C.nom, "client", false);
  }
});

test("une boutique suspendue quitte le catalogue", async ({ browser }) => {
  await suspendre(V.nom, "merchant", true);
  try {
    const page = await personne(browser);
    await page.goto(`/recherche?q=${encodeURIComponent("riz " + id)}`);
    await expect(page.getByText(PRODUIT)).toHaveCount(0);
    const r = await page.goto(`/produit/${produitId}`);
    expect(r?.status()).toBe(404);
  } finally {
    await suspendre(V.nom, "merchant", false);
  }
});

test("le commerçant supprime son compte : produit retiré, connexion refusée", async ({ browser }) => {
  const page = await personne(browser);
  await connecter(page, V.email, V.mdp);
  await page.goto("/compte/informations/supprimer");
  await page.getByRole("button", { name: "Supprimer définitivement mon compte" }).click();
  await expect(page).toHaveURL(/\/connexion/);

  const visiteur = await personne(browser);
  const r = await visiteur.goto(`/produit/${produitId}`);
  expect(r?.status()).toBe(404);
  await visiteur.goto("/connexion");
  await visiteur.getByLabel("Email").fill(V.email);
  await visiteur.getByLabel("Mot de passe").fill(V.mdp);
  await visiteur.getByRole("button", { name: /connecter/i }).click();
  await expect(visiteur).toHaveURL(/\/connexion/);
  await expect(visiteur.getByText(/supprimé|fermé/i).first()).toBeVisible();
});
