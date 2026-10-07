import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { messageErreurAuth } from "./erreurs-auth";
import { supabase } from "./supabase";

/**
 * Le compte de la connexion : mêmes règles que `src/lib/actions/account.ts`
 * et `auth.ts` du site.
 */

const SITE = process.env.EXPO_PUBLIC_SITE_URL;
const MOT_DE_PASSE_MIN = 8;
const NOM_MIN = 2;
const NOM_MAX = 80;
const INVISIBLES = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const nettoyer = (t: string) => t.replace(INVISIBLES, "").trim();
const nettoyerTelephone = (v: string) => v.replace(/[\s.\-()]/g, "").replace(/^\+224/, "").replace(/^00224/, "");

/**
 * Supabase n'a pas d'appel « vérifie ce mot de passe » : on se connecte
 * avec un client JETABLE, sans stockage, pour qu'une faute de frappe ne
 * déconnecte pas l'app (`passwordIsValid` du site). On ne le déconnecte
 * pas : `signOut()` révoquerait toutes les sessions, celle de l'app comprise.
 */
export async function motDePasseValide(email: string, motDePasse: string): Promise<boolean> {
  const jetable = createClient<Database>(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await jetable.auth.signInWithPassword({ email, password: motDePasse });
  return !error && Boolean(data?.session);
}

/** Même contrôle que `erreurNouveauMotDePasse` du site ; sans `trim` : une espace de bord fait partie du mot de passe. */
export function erreurNouveauMotDePasse(motDePasse: string, confirmation: string): string | null {
  if (motDePasse.length < MOT_DE_PASSE_MIN) return `${MOT_DE_PASSE_MIN} caractères minimum pour le mot de passe.`;
  if (motDePasse !== confirmation) return "Les deux mots de passe ne correspondent pas.";
  return null;
}

/**
 * Le lien de l'email s'ouvre sur le SITE (`/auth/confirm` puis
 * `/reinitialiser-mot-de-passe`), où se choisit le nouveau mot de passe.
 * Toujours « envoyé », même pour une adresse inconnue : répondre autrement
 * révélerait qui a un compte.
 */
export async function demanderReinitialisation(email: string): Promise<void> {
  const adresse = email.trim();
  if (!adresse) return;
  const apres = "/reinitialiser-mot-de-passe";
  const { error } = await supabase.auth.resetPasswordForEmail(adresse, {
    redirectTo: SITE ? `${SITE}/auth/confirm?next=${encodeURIComponent(apres)}` : undefined,
  });
  if (error) console.error("[compte] réinitialisation :", error.message);
}

/**
 * Changer son mot de passe en le CONNAISSANT : un téléphone emprunté
 * trente secondes ne doit pas suffire à fermer la porte derrière soi.
 */
export async function changerMotDePasse(email: string, actuel: string, nouveau: string, confirmation: string): Promise<string | null> {
  const refus = erreurNouveauMotDePasse(nouveau, confirmation);
  if (refus) return refus;
  if (!actuel) return "Entrez votre mot de passe actuel.";
  if (!(await motDePasseValide(email, actuel))) return "Mot de passe actuel incorrect.";
  const { error } = await supabase.auth.updateUser({ password: nouveau });
  return error ? messageErreurAuth(error.message) : null;
}

export type Informations = { nom: string; telephone: string; villeId: number | null; aUnCompteClient: boolean };

export async function lireInformations(authUserId: string): Promise<Informations | null> {
  const { data, error } = await supabase.from("profiles").select("role, full_name, phone, city_id").eq("auth_user_id", authUserId);
  if (error) throw error;
  if (data.length === 0) return null;
  const client = data.find((p) => p.role === "client");
  const premier = client ?? data[0];
  return { nom: premier.full_name, telephone: premier.phone ?? "", villeId: client?.city_id ?? null, aUnCompteClient: Boolean(client) };
}

/**
 * Nom et téléphone appartiennent à la CONNEXION : ils s'écrivent sur tous
 * ses profils. La ville, non : c'est la résidence du client, celle du
 * commerçant est celle de sa boutique. Mot de passe exigé : ce numéro est
 * celui par lequel un commerçant rappelle.
 */
export async function enregistrerInformations(opts: {
  authUserId: string;
  email: string;
  motDePasse: string;
  nom: string;
  telephone: string;
  villeId: number | null;
  aUnCompteClient: boolean;
}): Promise<string | null> {
  const nom = nettoyer(opts.nom);
  const telephone = nettoyerTelephone(opts.telephone.trim());
  if (!nom || !telephone) return "Le nom et le téléphone sont obligatoires.";
  if ([...nom].length < NOM_MIN) return `Nom complet : ${NOM_MIN} caractères visibles minimum.`;
  if ([...nom].length > NOM_MAX) return `Nom complet : ${NOM_MAX} caractères maximum.`;
  if (!/^6\d{8}$/.test(telephone)) return "Entrez un numéro guinéen à 9 chiffres commençant par 6 (exemple : 622 33 44 55).";
  if (!opts.motDePasse) return "Confirmez avec votre mot de passe actuel pour enregistrer.";
  if (!(await motDePasseValide(opts.email, opts.motDePasse))) {
    return "Mot de passe actuel incorrect. Aucune modification n'a été enregistrée.";
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: nom, phone: telephone })
    .eq("auth_user_id", opts.authUserId)
    .select("id");
  // Un `update` écarté par le RLS répond un succès à zéro ligne : on ne le prend pas pour un enregistrement.
  if (error || !data || data.length === 0) return "Modification impossible. Reconnectez-vous, puis réessayez.";

  if (opts.aUnCompteClient) {
    const { error: erreurVille } = await supabase
      .from("profiles")
      .update({ city_id: opts.villeId })
      .eq("auth_user_id", opts.authUserId)
      .eq("role", "client");
    if (erreurVille) return "Nom et téléphone enregistrés, mais pas la ville. Réessayez.";
  }
  return null;
}

/**
 * La suppression du compte exige la clé `service_role` (anonymiser les
 * profils et bannir la connexion ensemble) : elle se fait sur le site
 * tant que l'app n'a pas de fonction serveur.
 */
export const lienSuppression = SITE ? `${SITE}/compte/informations/supprimer` : null;
