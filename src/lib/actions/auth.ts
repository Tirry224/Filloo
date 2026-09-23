"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteUrlOuLocalhost } from "@/lib/site-url";
import { getMyProfiles, getSessionUser, landingForSession } from "@/lib/data/session";
import { safeNextPath } from "@/lib/next-param";
import { erreurNouveauMotDePasse, LONGUEUR_MIN_MOT_DE_PASSE } from "@/lib/password";
import { erreurTelephone, nettoyerTelephone } from "@/lib/telephone";
import { passwordIsValid } from "@/lib/supabase/verify";
import { compter } from "@/lib/analytics";

export type ActionState = { error?: string; needsConfirmation?: boolean; sent?: boolean };

function translateAuthError(message: string): string {
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Un compte existe déjà avec cet email. Connectez-vous : vous pourrez ajouter votre second compte depuis « Mon compte », sans changer d'adresse.";
  }
  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("Password should be at least")) {
    return `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum pour le mot de passe.`;
  }
  return message;
}

/** Premier compte de la connexion : le trigger
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
  const erreurNumero = erreurTelephone(phone, true);
  if (erreurNumero) return { error: erreurNumero };
  const erreurMotDePasse = erreurNouveauMotDePasse(password, passwordConfirmation);
  if (erreurMotDePasse) return { error: erreurMotDePasse };

  const supabase = await createClient();

  /* L'INTENTION DOIT SURVIVRE AU LIEN DE CONFIRMATION. Sans
     `emailRedirectTo`, Supabase ramène à la racine du site : quelqu'un qui
     s'inscrit depuis « Contacter le vendeur » perd le produit qu'il
     voulait justement contacter, et se retrouve sur l'accueil sans
     comprendre pourquoi. On repasse donc par `/auth/confirm`, qui échange
     le jeton puis suit `next` — le même chemin que la réinitialisation de
     mot de passe.

     Latent tant que la confirmation d'email est désactivée côté Supabase,
     et bloquant le jour où on l'active : c'est pour ce jour-là que ces
     trois lignes existent. */
  const apresConfirmation = safeNextPath(formData.get("next"));
  const retour = `${siteUrlOuLocalhost()}/auth/confirm${
    apresConfirmation ? `?next=${encodeURIComponent(apresConfirmation)}` : ""
  }`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name: fullName, phone: nettoyerTelephone(phone) },
      emailRedirectTo: retour,
    },
  });
  if (error) return { error: translateAuthError(error.message) };

  compter("inscription", { role });

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
      phone: existant.phone,
    });
  if (error) {
    if (error.code === "23505") return { error: "Vous avez déjà ce type de compte." };
    return { error: error.message };
  }

  compter("inscription", { role });

  if (role === "merchant") redirect("/inscription/boutique");
  redirect(safeNextPath(formData.get("next")) ?? "/");
}

/**
 * Où atterrir après s'être authentifié — connexion OU réinitialisation de
 * mot de passe. Jamais `/` en dur : `landingForSession` tranche
 * (décision 8 de SPEC), et `next` ne fait que CHOISIR une destination à
 * l'intérieur de l'espace autorisé, il ne défait pas la décision.
 */
async function destinationApresAuthentification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brut: FormDataEntryValue | null,
): Promise<string> {
  const landing = await landingForSession(supabase);
  const next = safeNextPath(brut);
  const espaceCommercantSeul = landing === "/vendeur";
  const autorise =
    next && (!espaceCommercantSeul || next === "/vendeur" || next.startsWith("/vendeur/"));
  return autorise ? next : landing;
}

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
  redirect(await destinationApresAuthentification(supabase, formData.get("next")));
}

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
  /* L'origine vient de la configuration, plus de l'en-tête `Host` : celui-ci
     est envoyé par le CLIENT, donc c'était lui qui décidait où pointait le
     lien de réinitialisation. Rien n'était exploitable — Supabase refuse
     un `redirectTo` hors de sa liste d'URL autorisées — mais la protection
     vivait entièrement dans un réglage de tableau de bord, invisible
     depuis le dépôt. Elle est maintenant écrite ici aussi. */
  const origin = siteUrlOuLocalhost();
  /* `next` traverse DEUX redirections avant de servir : `/auth/confirm`
     échange le jeton, puis envoie sur `/reinitialiser-mot-de-passe`, qui
     le repasse à son formulaire. D'où l'encodage imbriqué — et
     `safeNextPath` des deux côtés, à l'aller comme au retour, parce que ce
     chemin voyage dans un email que n'importe qui peut réécrire. */
  const suite = safeNextPath(formData.get("next"));
  /* SANS `next`, aucun paramètre du tout. La liste blanche de redirection
     de Supabase compare l'URL ENTIÈRE, chaîne de requête comprise, et un
     motif `https://site/**` ne couvre pas un `?` de façon fiable. Une URL
     rejetée ne produit pas d'erreur : Supabase retombe en silence sur le
     « Site URL » du tableau de bord — l'accueil — et la personne ne voit
     jamais le formulaire. Le cas est arrivé en production. */
  const redirectTo = suite
    ? `${origin}/auth/confirm?next=${encodeURIComponent(`/reinitialiser-mot-de-passe?next=${encodeURIComponent(suite)}`)}`
    : `${origin}/auth/confirm`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  // `sent: true` dans TOUS les cas : répondre autrement pour une adresse
  // inconnue révélerait qui a un compte ici. L'erreur se journalise —
  // l'échec attendu est le quota du serveur mail.
  if (error) console.error("resetPasswordForEmail a échoué :", error.message);
  return { sent: true };
}

/** Suppose une session "recovery" déjà active (échangée par
 * /auth/confirm). */
export async function updatePasswordAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");

  const erreurMotDePasse = erreurNouveauMotDePasse(password, passwordConfirmation);
  if (erreurMotDePasse) return { error: erreurMotDePasse };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translateAuthError(error.message) };

  redirect(await destinationApresAuthentification(supabase, formData.get("next")));
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

  return { sent: true };
}
