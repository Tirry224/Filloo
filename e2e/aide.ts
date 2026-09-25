import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Les gestes que l'application n'offre à personne — valider une boutique,
 * suspendre un compte — se font en production dans le tableau de bord
 * Supabase. Ici, par la clé `service_role` de la pile LOCALE.
 */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquent : voir e2e/README.md.");
  }
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error(`Refus : ces tests écrivent en base, et ${url} n'est pas une pile locale.`);
  }
  return createClient(url, cle, { auth: { persistSession: false } });
}

export async function validerBoutique(nom: string) {
  const { error } = await admin().from("merchants").update({ valider: true }).eq("shop_name", nom);
  if (error) throw error;
}

export async function suspendre(nom: string, role: "client" | "merchant", oui: boolean) {
  const { error } = await admin()
    .from("profiles")
    .update({ is_suspended: oui, suspended_at: oui ? new Date().toISOString() : null })
    .eq("full_name", nom)
    .eq("role", role);
  if (error) throw error;
}

export async function produitParTitre(titre: string) {
  const { data, error } = await admin().from("products").select("id, status").eq("title", titre);
  if (error) throw error;
  return data;
}

export async function signalementsEnAttente(produitId: string) {
  const { count, error } = await admin()
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("target_id", produitId)
    .is("handled_at", null);
  if (error) throw error;
  return count;
}

/** Un PNG d'un pixel, mais valide : assez pour le champ photo. */
export const PHOTO = {
  name: "produit.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
};

/** Un suffixe unique : chaque passage crée ses propres comptes. */
export const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export async function inscrire(
  page: Page,
  o: { role: "Acheter" | "Vendre"; nom: string; tel: string; email: string; mdp: string },
) {
  await page.goto("/inscription");
  await page.getByText(o.role, { exact: true }).click();
  await page.getByLabel("Nom complet").fill(o.nom);
  await page.getByLabel("Téléphone").fill(o.tel);
  await page.getByLabel("Email").fill(o.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(o.mdp);
  await page.getByLabel("Confirmer le mot de passe").fill(o.mdp);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
}

export async function connecter(page: Page, email: string, mdp: string) {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(mdp);
  await page.getByRole("button", { name: /connecter/i }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}
