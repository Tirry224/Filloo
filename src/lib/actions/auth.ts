"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getMyProfiles, getSessionUser, landingForSession } from "@/lib/data/session";
import { safeNextPath } from "@/lib/next-param";
import { erreurNouveauMotDePasse, LONGUEUR_MIN_MOT_DE_PASSE } from "@/lib/password";
import { erreurTelephone, nettoyerTelephone } from "@/lib/telephone";
import { passwordIsValid } from "@/lib/supabase/verify";

export type ActionState = { error?: string; needsConfirmation?: boolean; sent?: boolean };

/** Messages Supabase traduits pour les cas qu'un utilisateur rencontre
 * vraiment ; le reste (rare, souvent un problème réseau ou de config)
 * garde le message d'origine plutôt qu'un texte français générique qui
 * cacherait l'information utile en cas de bug. */
function translateAuthError(message: string): string {
  if (message.includes("already registered") || message.includes("already exists")) {
    // Dire la suite, sinon qui veut « aussi vendre » repart avec un
    // deuxième email — et deux comptes ne se fusionnent pas.
    return "Un compte existe déjà avec cet email. Connectez-vous : vous pourrez ajouter votre second compte depuis « Mon compte », sans changer d'adresse.";
  }
  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("Password should be at least")) {
    // Même constante que nos propres contrôles : deux textes annonçant des
    // longueurs différentes rendraient le refus incompréhensible.
    return `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum pour le mot de passe.`;
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
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");

  if (!fullName || !phone || !email || !password) {
    return { error: "Tous les champs sont obligatoires." };
  }
  // Vérifié AVANT la création : un numéro injoignable ne se corrige que
  // dans « Mes informations », un écran que personne ne rouvre.
  const erreurNumero = erreurTelephone(phone, true);
  if (erreurNumero) return { error: erreurNumero };
  // Double saisie : seul champ qu'on ne peut pas relire, et mal tapé il
  // enferme dehors — la faute coûte une réinitialisation par email.
  const erreurMotDePasse = erreurNouveauMotDePasse(password, passwordConfirmation);
  if (erreurMotDePasse) return { error: erreurMotDePasse };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, full_name: fullName, phone: nettoyerTelephone(phone) } },
  });
  if (error) return { error: translateAuthError(error.message) };

  // `data.session` est null quand la confirmation par email est activée
  // (réglage Supabase) : le compte existe, mais aucune session tant que le
  // lien n'est pas cliqué. On le dit plutôt que de rediriger dans le vide.
  if (!data.session) return { needsConfirmation: true };

  if (role === "merchant") redirect("/inscription/boutique");
  // `next` porte l'intention qui a mené ici, presque toujours « contacter
  // ce vendeur » (écran 16). `safeNextPath` refuse toute adresse externe.
  redirect(safeNextPath(formData.get("next")) ?? "/");
}

/**
 * Créer le SECOND compte lié (écran 12, déjà connecté) : même connexion,
 * juste un nouveau profil (policy « profiles: je cree mon second compte »,
 * 0002).
 *
 * Le nom et le téléphone se RECOPIENT depuis le profil existant : ils
 * appartiennent à la connexion, pas au rôle. Les saisir ici permettrait de
 * réécrire le premier profil sans confirmation par mot de passe.
 */
export async function createLinkedProfileAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const role = formData.get("role") === "merchant" ? "merchant" : "client";

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Vous devez être connecté." };

  // L'identité vient du profil existant, jamais du formulaire. Sans
  // profil, on n'est pas dans le cas « second compte ».
  const profiles = await getMyProfiles(supabase);
  const existant = profiles.find((p) => !p.isDeleted);
  if (!existant) return { error: "Aucun compte à lier. Reconnectez-vous, puis réessayez." };

  const { error } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: user.id,
      role,
      full_name: existant.fullName,
      // Déjà normalisé à l'écriture ; le repasser par `nettoyerTelephone`
      // laisserait croire que cette valeur vient d'être saisie.
      phone: existant.phone,
    });
  if (error) {
    if (error.code === "23505") return { error: "Vous avez déjà ce type de compte." };
    return { error: error.message };
  }

  if (role === "merchant") redirect("/inscription/boutique");
  // Même reprise d'intention qu'à l'inscription : ce compte client vient
  // peut-être d'être créé POUR écrire à un vendeur.
  redirect(safeNextPath(formData.get("next")) ?? "/");
}

/** Connexion — écran 14. */
export async function signInAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email et mot de passe obligatoires." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translateAuthError(error.message) };

  /* Où atterrir : jamais `/` en dur, `landingForSession` tranche
     (décision 8 de SPEC). `next` n'est suivi que s'il reste dans l'espace
     autorisé — un paramètre d'URL ne défait pas la décision 8, il choisit
     seulement une destination à l'intérieur. */
  const landing = await landingForSession(supabase);
  const next = safeNextPath(formData.get("next"));
  const espaceCommercantSeul = landing === "/vendeur";
  const nextAutorise =
    next && (!espaceCommercantSeul || next === "/vendeur" || next.startsWith("/vendeur/"));
  redirect(nextAutorise ? next : landing);
}

/** Déconnexion. Utilisée depuis /compte et /vendeur/boutique. */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}

/** Mot de passe oublié — écran 15. Toujours le même message, que le
 * compte existe ou non. */
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
  // `sent: true` dans TOUS les cas : répondre autrement pour une adresse
  // inconnue révélerait qui a un compte ici. L'erreur se journalise —
  // l'échec attendu est le quota du serveur mail.
  if (error) console.error("resetPasswordForEmail a échoué :", error.message);
  return { sent: true };
}

/** Nouveau mot de passe — après le lien de /mot-de-passe-oublie. Suppose
 * une session "recovery" déjà active (échangée par /auth/confirm). */
export async function updatePasswordAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");

  // Le lien qui mène ici ne sert qu'une fois : une frappe ratée oblige à
  // redemander un email et refaire tout le trajet.
  const erreurMotDePasse = erreurNouveauMotDePasse(password, passwordConfirmation);
  if (erreurMotDePasse) return { error: erreurMotDePasse };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translateAuthError(error.message) };

  // Même aiguillage qu'après une connexion : changer son mot de passe
  // n'est pas une raison d'atterrir dans un autre espace.
  redirect(await landingForSession(supabase));
}

/**
 * Changer son mot de passe depuis son compte, en le CONNAISSANT.
 *
 * Distincte de `updatePasswordAction`, dont la preuve est le lien reçu par
 * email : deux preuves, donc deux actions — les fondre rendrait le
 * contrôle facultatif. Ce qu'elle empêche : un téléphone emprunté trente
 * secondes suffirait à fermer la porte derrière soi.
 */
export async function changeMyPasswordAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const newPasswordConfirmation = String(formData.get("newPasswordConfirmation") ?? "");

  // L'ordre suit le coût : la forme du nouveau mot de passe d'abord,
  // gratuite, le mot de passe actuel ensuite, qui coûte un aller-retour.
  const erreurMotDePasse = erreurNouveauMotDePasse(newPassword, newPasswordConfirmation);
  if (erreurMotDePasse) return { error: erreurMotDePasse };

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user?.email) return { error: "Vous devez être connecté." };

  if (!currentPassword) return { error: "Entrez votre mot de passe actuel." };
  if (!(await passwordIsValid(user.email, currentPassword))) {
    return { error: "Mot de passe actuel incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: translateAuthError(error.message) };

  // Pas de redirection : le formulaire vit dans un panneau posé sur
  // l'écran de compte, et renvoyer ailleurs ferait perdre sa place.
  return { sent: true };
}
