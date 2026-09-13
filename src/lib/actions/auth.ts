"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, landingForSession } from "@/lib/data/session";

export type ActionState = { error?: string; needsConfirmation?: boolean; sent?: boolean };

/** Messages Supabase traduits pour les cas qu'un utilisateur rencontre
 * vraiment ; le reste (rare, souvent un problème réseau ou de config)
 * garde le message d'origine plutôt qu'un texte français générique qui
 * cacherait l'information utile en cas de bug. */
function translateAuthError(message: string): string {
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Un compte existe déjà avec cet email. Essayez de vous connecter.";
  }
  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("Password should be at least")) {
    return "8 caractères minimum pour le mot de passe.";
  }
  return message;
}

/** Inscription — écran 12. Premier compte de la connexion : le trigger
 * `handle_new_user` (0002_rules_and_security.sql) crée le profil à partir
 * des métadonnées envoyées ici. */
export async function signUpAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const role = formData.get("role") === "merchant" ? "merchant" : "client";
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !phone || !email || !password) {
    return { error: "Tous les champs sont obligatoires." };
  }
  if (password.length < 8) {
    return { error: "8 caractères minimum pour le mot de passe." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, full_name: fullName, phone } },
  });
  if (error) return { error: translateAuthError(error.message) };

  // `data.session` est null quand la confirmation par email est activée
  // (réglage du tableau de bord Supabase) : le compte existe déjà côté
  // auth.users, mais aucune connexion n'est active tant que le lien reçu
  // par email n'a pas été cliqué. Impossible d'aller plus loin dans l'app
  // dans ce cas — on le dit plutôt que de rediriger vers un écran qui
  // échouerait faute de session.
  if (!data.session) return { needsConfirmation: true };

  if (role === "merchant") redirect("/inscription/boutique");
  redirect("/");
}

/** Créer le SECOND compte lié (écran 12, en étant déjà connecté) : pas de
 * mot de passe à saisir, c'est la même connexion — juste un nouveau profil
 * (policy "profiles: je cree mon second compte", 0002). */
export async function createLinkedProfileAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const role = formData.get("role") === "merchant" ? "merchant" : "client";
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!fullName || !phone) return { error: "Tous les champs sont obligatoires." };

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Vous devez être connecté." };

  const { error } = await supabase
    .from("profiles")
    .insert({ auth_user_id: user.id, role, full_name: fullName, phone });
  if (error) {
    if (error.code === "23505") return { error: "Vous avez déjà ce type de compte." };
    return { error: error.message };
  }

  if (role === "merchant") redirect("/inscription/boutique");
  redirect("/");
}

/** Connexion — écran 14. */
export async function signInAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email et mot de passe obligatoires." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translateAuthError(error.message) };

  // Jamais `/` en dur : une connexion qui n'a qu'un compte commerçant
  // atterrissait sur le fil client, avec la barre d'onglets du client —
  // ce que `design/README.md` interdit explicitement. Voir
  // `landingForSession`.
  redirect(await landingForSession(supabase));
}

/** Déconnexion. Utilisée depuis /compte et /vendeur/boutique. */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}

/** Mot de passe oublié — écran 15. Toujours le même message, que le
 * compte existe ou non : voir le commentaire déjà présent sur cet écran. */
export async function requestPasswordResetAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { sent: true };

  const supabase = await createClient();
  const host = (await headers()).get("host");
  const origin = `${process.env.NODE_ENV === "development" ? "http" : "https"}://${host}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reinitialiser-mot-de-passe`,
  });
  // La réponse rendue reste `sent: true` DANS TOUS LES CAS, y compris en
  // cas d'échec : répondre autre chose pour une adresse inconnue dirait à
  // un inconnu qui a un compte ici. Ce n'est pas un oubli, c'est la
  // protection contre l'énumération des comptes, et elle ne bouge pas.
  //
  // Mais l'erreur était jusqu'ici invisible AUSSI côté serveur, ce qui est
  // un autre problème : le serveur mail intégré de Supabase plafonne à
  // quelques envois par heure (étape 2 de docs/REPRISE.md), donc l'échec
  // attendu ici est le dépassement de quota — précisément celui qu'il faut
  // pouvoir constater dans les journaux Vercel pour savoir que Resend
  // devient urgent.
  if (error) console.error("resetPasswordForEmail a échoué :", error.message);
  return { sent: true };
}

/** Nouveau mot de passe — après le lien de /mot-de-passe-oublie. Suppose
 * une session "recovery" déjà active (échangée par /auth/confirm). */
export async function updatePasswordAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "8 caractères minimum pour le mot de passe." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translateAuthError(error.message) };

  // Même aiguillage qu'après une connexion : changer son mot de passe
  // n'est pas une raison d'atterrir dans l'espace de quelqu'un d'autre.
  redirect(await landingForSession(supabase));
}
