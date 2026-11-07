import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Les gestes que l'application n'offre à personne, comme suspendre un
 * compte, se font en production dans le tableau de bord
 * Supabase. Ici, par la clé `service_role` de la pile LOCALE.
 */
export function admin() {
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
  await page.getByLabel("Mot de passe", { exact: true }).fill(mdp);
  await page.getByRole("button", { name: /connecter/i }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}

/**
 * Un membre de l'équipe Filloo, comme le porteur du projet l'inscrit au
 * tableau de bord : une connexion confirmée, sans profil (l'équipe n'a
 * que `/admin`, 0043), une ligne `equipe`.
 */
export async function creerMembre(o: { email: string; mdp: string; nom: string; proprietaire: boolean }) {
  const a = admin();
  const { data, error } = await a.auth.admin.createUser({ email: o.email, password: o.mdp, email_confirm: true });
  if (error) throw error;
  const uid = data.user.id;
  // `handle_new_user` a pu lui créer un profil client : l'équipe n'en a pas.
  await a.from("profiles").delete().eq("auth_user_id", uid);
  // Un seul propriétaire (0067) : celui d'un passage précédent cède la place.
  if (o.proprietaire) await a.from("equipe").update({ proprietaire: false }).eq("proprietaire", true);
  const { error: e2 } = await a.from("equipe").insert({ auth_user_id: uid, nom: o.nom, proprietaire: o.proprietaire });
  if (e2) throw e2;
  return uid;
}
