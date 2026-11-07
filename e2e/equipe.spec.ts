import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { admin, connecter, creerMembre, inscrire, PHOTO, produitParTitre, unique } from "./aide";

/*
 * L'équipe gère le site depuis /admin (décisions du 2026-11-07) : seul le
 * propriétaire fait entrer ou sortir un membre ; vendeurs et acheteurs ont
 * chacun leur liste ; une fiche dit tout et son retour ramène à la liste ;
 * suspendre et supprimer prennent effet AUSSITÔT (catalogue et session) ;
 * l'équipe écrit en premier ; retirer une catégorie refait l'ordre.
 * Un seul récit, dans l'ordre, contre la pile LOCALE.
 */
test.describe.configure({ mode: "serial" });

const id = unique();
const PROPRIO = { email: `proprio-${id}@exemple.com`, mdp: "motdepasse-p1", nom: `Tirry ${id}` };
const MEMBRE = { email: `membre-${id}@exemple.com`, mdp: "motdepasse-m1", nom: `Awa ${id}` };
const V = { nom: `Fanta ${id}`, tel: "622556677", email: `vend-${id}@exemple.com`, mdp: "motdepasse-v2" };
const C = { nom: `Ousmane ${id}`, tel: "620998877", email: `ach-${id}@exemple.com`, mdp: "motdepasse-c2" };
const BOUTIQUE = `Chez Fanta ${id}`;
const PRODUIT = `Pagne wax ${id}`;
const PREMIER_MOT = `Bonjour de l'équipe ${id}`;
let produitId = "";
let profilVendeur = "";
let profilClient = "";

const ouverts: BrowserContext[] = [];
async function personne(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext(test.info().project.use);
  ouverts.push(ctx);
  return ctx.newPage();
}
test.afterEach(async () => {
  while (ouverts.length) await ouverts.pop()!.close();
});

async function profilDe(nom: string, role: "client" | "merchant") {
  const { data, error } = await admin().from("profiles").select("id, is_deleted, is_suspended").eq("full_name", nom).eq("role", role);
  if (error) throw error;
  return data;
}

test("mise en place : deux membres, une boutique avec un produit, un acheteur", async ({ browser }) => {
  // Pile locale : l'équipe d'un passage précédent s'en va, ce récit compte ses membres.
  await admin().from("equipe").delete().not("auth_user_id", "is", null);
  await creerMembre({ ...PROPRIO, proprietaire: true });
  await creerMembre({ ...MEMBRE, proprietaire: false });

  const v = await personne(browser);
  await inscrire(v, { role: "Vendre", ...V });
  await expect(v).toHaveURL(/\/inscription\/boutique/);
  await v.getByLabel("Nom de la boutique").fill(BOUTIQUE);
  await v.getByLabel("Ville").selectOption({ index: 1 });
  await v.getByLabel("Où vous trouver").fill("Marché Niger");
  await v.getByLabel("Numéro WhatsApp").fill(V.tel);
  await v.getByLabel("Que vendez-vous ?").fill("Tissus");
  await v.getByRole("button", { name: "Ouvrir ma boutique" }).click();
  await expect(v).toHaveURL(/\/vendeur$/);
  await v.goto("/vendeur/produits/nouveau");
  await v.locator("input[type=file]").setInputFiles(PHOTO);
  await expect(v.locator("input[name=imagePaths]")).toHaveCount(1, { timeout: 20_000 });
  await v.getByLabel("Titre").fill(PRODUIT);
  await v.getByLabel("Catégorie").selectOption({ index: 1 });
  await v.getByLabel("Prix", { exact: true }).fill("120000");
  await v.getByLabel("Description").fill("Six yards, coton.");
  await v.getByRole("button", { name: "Publier le produit" }).click();
  await expect(v).not.toHaveURL(/nouveau/);
  produitId = (await produitParTitre(PRODUIT))![0].id;

  const c = await personne(browser);
  await inscrire(c, { role: "Acheter", ...C });
  await expect(c).not.toHaveURL(/\/inscription/);

  profilVendeur = (await profilDe(V.nom, "merchant"))[0].id;
  profilClient = (await profilDe(C.nom, "client"))[0].id;
});

test("seul le propriétaire ajoute ou retire un membre", async ({ browser }) => {
  const p = await personne(browser);
  await connecter(p, PROPRIO.email, PROPRIO.mdp);
  await p.goto("/admin");
  await expect(p.locator("header").getByText("Propriétaire")).toBeVisible();
  await p.goto("/admin/gestion/equipe");
  await expect(p.getByText("Propriétaire").first()).toBeVisible();
  await expect(p.getByRole("heading", { name: "Ajouter un membre" })).toBeVisible();
  await expect(p.getByText("Retirer de l'équipe")).toHaveCount(1); // le membre, pas lui-même

  const m = await personne(browser);
  await connecter(m, MEMBRE.email, MEMBRE.mdp);
  await m.goto("/admin");
  await expect(m.locator("header").getByText("Équipe", { exact: true })).toBeVisible();
  await expect(m.locator("header").getByText("Propriétaire")).toHaveCount(0);
  await m.goto("/admin/gestion/equipe");
  await expect(m.getByText(/Seul le propriétaire/)).toBeVisible();
  await expect(m.getByRole("heading", { name: "Ajouter un membre" })).toHaveCount(0);
  await expect(m.getByText("Retirer de l'équipe")).toHaveCount(0);

  // Et la BASE refuse, pas seulement l'écran.
  const brut = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  await brut.auth.signInWithPassword({ email: MEMBRE.email, password: MEMBRE.mdp });
  const { error } = await brut.rpc("ajouter_membre", { p_email: C.email, p_nom: "Intrus" });
  expect(error?.message).toContain("Réservé au propriétaire");
});

test("vendeurs et acheteurs ont chacun leur liste ; la fiche dit tout et revient à sa liste", async ({ browser }) => {
  const m = await personne(browser);
  await connecter(m, MEMBRE.email, MEMBRE.mdp);
  await m.goto(`/admin/gestion/vendeurs?q=${encodeURIComponent(id)}`);
  await expect(m.getByText(BOUTIQUE)).toBeVisible();
  await expect(m.getByText(C.nom)).toHaveCount(0);
  await m.goto(`/admin/gestion/acheteurs?q=${encodeURIComponent(id)}`);
  await expect(m.getByText(C.nom)).toBeVisible();
  await expect(m.getByText(BOUTIQUE)).toHaveCount(0);

  await m.goto(`/admin/gestion/vendeurs?q=${encodeURIComponent(id)}`);
  await m.getByText(BOUTIQUE).click();
  await expect(m).toHaveURL(new RegExp(`/admin/gestion/vendeurs/${profilVendeur}`));
  await expect(m.getByText(V.email)).toBeVisible();
  await expect(m.getByText("Marché Niger")).toBeVisible();
  await expect(m.getByText(PRODUIT)).toBeVisible();
  await m.getByRole("link", { name: "Retour" }).click();
  await expect(m).toHaveURL(new RegExp(`/admin/gestion/vendeurs\\?q=${id}`));
});

test("suspendre une boutique la retire du catalogue AUSSITÔT", async ({ browser }) => {
  const visiteur = await personne(browser);
  // Le cache public garde la fiche : on la charge AVANT, pour prouver qu'il est vidé.
  expect((await visiteur.goto(`/produit/${produitId}`))?.status()).toBe(200);

  const m = await personne(browser);
  await connecter(m, MEMBRE.email, MEMBRE.mdp);
  await m.goto(`/admin/gestion/vendeurs/${profilVendeur}`);
  await m.getByText("Suspendre ce compte").click();
  await m.getByPlaceholder("Motif, montré à la personne").fill("Test de suspension");
  await m.getByRole("button", { name: "Suspendre", exact: true }).click();
  await expect(m.getByText("Compte suspendu.")).toBeVisible();

  expect((await visiteur.goto(`/produit/${produitId}`))?.status()).toBe(404);

  await m.getByText("Réactiver ce compte").click();
  await m.getByPlaceholder("Pourquoi réactiver (interne à l'équipe)").fill("Fin du test");
  await m.getByRole("button", { name: "Réactiver", exact: true }).click();
  await expect(m.getByText("Compte réactivé.")).toBeVisible();
  expect((await visiteur.goto(`/produit/${produitId}`))?.status()).toBe(200);
});

test("l'équipe écrit en premier, l'acheteur lit le message", async ({ browser }) => {
  const m = await personne(browser);
  await connecter(m, MEMBRE.email, MEMBRE.mdp);
  // Par la recherche des Messages : l'acheteur n'a jamais écrit à l'équipe
  // (une boutique, elle, a déjà le mot de bienvenue de 0056).
  await m.goto(`/admin?q=${encodeURIComponent(C.nom)}`);
  await expect(m.getByText("Écrire en premier")).toBeVisible();
  await m.getByRole("link", { name: new RegExp(C.nom) }).first().click();
  await m.getByLabel("Votre réponse").fill(PREMIER_MOT);
  await m.getByRole("button", { name: "Envoyer" }).click();
  await expect(m.getByText(PREMIER_MOT)).toBeVisible();

  const c = await personne(browser);
  await connecter(c, C.email, C.mdp);
  await c.goto("/compte/equipe/discussion");
  await expect(c.getByText(PREMIER_MOT)).toBeVisible();
});

test("supprimer un produit depuis la fiche", async ({ browser }) => {
  const m = await personne(browser);
  await connecter(m, MEMBRE.email, MEMBRE.mdp);
  await m.goto(`/admin/gestion/vendeurs/${profilVendeur}`);
  await m.getByText("Supprimer ce produit").click();
  const f = m.locator("form", { has: m.getByRole("button", { name: "Supprimer définitivement" }) }).first();
  await f.getByPlaceholder("Motif (interne à l'équipe)").fill("Produit de test");
  await f.getByLabel("Je confirme : c'est définitif.").check();
  await f.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(m.getByText("Produit supprimé.")).toBeVisible();
  expect(await produitParTitre(PRODUIT)).toHaveLength(0);
  const visiteur = await personne(browser);
  expect((await visiteur.goto(`/produit/${produitId}`))?.status()).toBe(404);
});

test("supprimer un acheteur le déconnecte AUSSITÔT", async ({ browser }) => {
  const c = await personne(browser);
  await connecter(c, C.email, C.mdp);
  await c.goto("/compte");
  await expect(c).toHaveURL(/\/compte/);

  const m = await personne(browser);
  await connecter(m, MEMBRE.email, MEMBRE.mdp);
  await m.goto(`/admin/gestion/acheteurs/${profilClient}`);
  await m.getByText("Supprimer ce compte").click();
  await m.getByPlaceholder("Motif (interne à l'équipe)").fill("Compte de test");
  await m.getByLabel("Je confirme : c'est définitif.").check();
  await m.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(m).toHaveURL(/\/admin\/gestion\/acheteurs/);
  await expect(m.getByText(/compte supprimé/)).toBeVisible();

  // Même navigateur, mêmes cookies : la session est fermée côté serveur.
  await c.goto("/compte");
  await expect(c).toHaveURL(/\/connexion/);
  const p = await profilDe("Compte supprimé", "client");
  expect(p.some((x) => x.id === profilClient && x.is_deleted)).toBe(true);
  const { data: journal } = await admin()
    .from("journal_equipe")
    .select("action")
    .eq("cible_id", profilClient)
    .eq("action", "supprimer_compte");
  expect(journal).toHaveLength(1);
});

test("retirer une catégorie refait l'ordre 1..n", async ({ browser }) => {
  const p = await personne(browser);
  await connecter(p, PROPRIO.email, PROPRIO.mdp);
  for (const nom of [`Cat A ${id}`, `Cat B ${id}`]) {
    await p.goto("/admin/gestion/catalogue");
    await p.getByLabel("Ajouter").first().fill(nom);
    await p.locator("form", { has: p.getByLabel("Ajouter").first() }).first().getByRole("button", { name: "Ajouter" }).click();
    await expect(p.getByText("Catégorie ajoutée.")).toBeVisible();
  }
  const a = admin();
  const { data: avant } = await a.from("categories").select("id, name").eq("name", `Cat A ${id}`).single();
  await a.from("categories").update({ position: 50 }).eq("id", avant!.id); // un trou, comme laissé à la main
  await p.goto("/admin/gestion/catalogue");
  // Le formulaire « Retirer » de CETTE catégorie (les villes, listées après, ont aussi des id).
  await p.locator(`form:has(input[name="id"][value="${avant!.id}"]):has(button:text-is("Retirer"))`).first()
    .getByRole("button", { name: "Retirer" }).click();
  await expect(p.getByText("Catégorie retirée.")).toBeVisible();
  const { data: apres } = await a.from("categories").select("position").order("position");
  expect(apres!.map((c) => c.position)).toEqual(apres!.map((_, i) => i + 1));
});
