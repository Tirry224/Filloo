"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteUrlOuLocalhost } from "@/lib/site-url";
import { connexionGoogleDeMoinsDeDixMinutes, getMyProfiles, getSessionUser, landingForSession, getMyDeletedRoles } from "@/lib/data/session";
import { safeNextPath } from "@/lib/next-param";
import { destinationApresAuthentification } from "@/lib/destination";
import { headers } from "next/headers";
import { aUnMotDePasse, erreurNouveauMotDePasse } from "@/lib/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { messageErreurAuth } from "@/lib/erreurs-auth";
import { erreurTelephone, nettoyerTelephone } from "@/lib/telephone";
import { refusMotDePasse } from "@/lib/supabase/verify";
import { compter } from "@/lib/analytics";
import { messagePourErreur } from "@/lib/erreurs";
import { erreurChampsManquants, erreurNom, texteNettoye } from "@/lib/saisie";

export type ActionState = {
  error?: string;
  needsConfirmation?: boolean;
  sent?: boolean;
  /** L'adresse à qui renvoyer le lien de confirmation. */
  email?: string;
};

/** `origine=inscription` dit à `/auth/confirm` qu'il traite un lien
 * d'inscription, même par l'ancienne voie (`code`) qui ne porte pas de
 * `type`. Le paramètre doit exister : le modèle d'email Supabase y colle
 * `&token_hash=…`. */
function lienDeConfirmation(next: string | null): string {
  return `${siteUrlOuLocalhost()}/auth/confirm?origine=inscription${
    next ? `&next=${encodeURIComponent(next)}` : ""
  }`;
}


/** Premier compte de la connexion : le trigger
 * `handle_new_user` (0002_rules_and_security.sql) crée le profil à partir
 * des métadonnées envoyées ici. */
export async function signUpAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const role = formData.get("role") === "merchant" ? "merchant" : "client";
  const fullName = texteNettoye(formData.get("fullName"));
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");

  const manquants = erreurChampsManquants([
    ["le nom complet", fullName],
    ["le téléphone", phone],
    ["l'email", email],
    ["le mot de passe", password],
  ]);
  if (manquants) return { error: manquants };
  const erreurNomComplet = erreurNom(fullName, "Nom complet");
  if (erreurNomComplet) return { error: erreurNomComplet };
  const erreurNumero = erreurTelephone(phone, true);
  if (erreurNumero) return { error: erreurNumero };
  const erreurMotDePasse = erreurNouveauMotDePasse(password, passwordConfirmation);
  if (erreurMotDePasse) return { error: erreurMotDePasse };

  const supabase = await createClient();

  /* Sans `next`, `/auth/confirm` choisit l'espace du compte : un
     commerçant y trouve `/inscription/boutique`. */
  const retour = lienDeConfirmation(safeNextPath(formData.get("next")));

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name: fullName, phone: nettoyerTelephone(phone) },
      emailRedirectTo: retour,
    },
  });
  if (error) return { error: messageErreurAuth(error.message) };

  await compter("inscription", { role });

  // `data.session` est null quand la confirmation par email est activée
  // (réglage Supabase) : aucune session tant que le lien n'est pas cliqué.
  if (!data.session) return { needsConfirmation: true, email };

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
  if (!user) return { error: "Connectez-vous d'abord." };

  // L'identité vient du profil existant, jamais du formulaire. Sans
  // profil, on n'est pas dans le cas « second compte ».
  const profiles = await getMyProfiles(supabase);
  const existant = profiles.find((p) => !p.isDeleted);
  if (!existant) return { error: "Aucun compte à lier. Reconnectez-vous." };

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
    /* Depuis `0041`, un compte supprimé se recrée — sauf s'il était
       SUSPENDU : supprimer puis recréer effacerait la sanction. La policy
       le refuse (RLS, 42501). */
    if (error.code === "42501" && (await getMyDeletedRoles(supabase)).includes(role)) {
      return { error: "Ce compte était suspendu : il ne peut pas être recréé. Écrivez-nous depuis la page Contact." };
    }
    return { error: messagePourErreur(error, "compte") };
  }

  await compter("inscription", { role });

  if (role === "merchant") redirect("/inscription/boutique");
  redirect(safeNextPath(formData.get("next")) ?? "/");
}

export async function signInAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const manquants = erreurChampsManquants([
    ["l'email", email],
    ["le mot de passe", password],
  ]);
  if (manquants) return { error: manquants };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error: messageErreurAuth(error.message),
      email: error.message.includes("Email not confirmed") ? email : undefined,
    };
  }

  /* Où atterrir : jamais `/` en dur, `landingForSession` tranche
     (décision 8 de SPEC). `next` n'est suivi que s'il reste dans l'espace
     autorisé — un paramètre d'URL ne défait pas la décision 8, il choisit
     seulement une destination à l'intérieur. */
  redirect(await destinationApresAuthentification(supabase, formData.get("next")));
}

/** Supabase répond pareil que l'adresse existe ou non, et ce message aussi :
 * il ne doit pas révéler qui a un compte. */
export async function resendConfirmationAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Entrez votre email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: lienDeConfirmation(null) },
  });
  if (error) return { error: messageErreurAuth(error.message), email };
  return { sent: true, email };
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
  /* TOUJOURS une chaîne de requête, `next` compris : le modèle d'email
     Supabase colle `&token_hash=…&type=recovery` au bout de cette adresse
     (`{{ .RedirectTo }}&token_hash=…`, voir `/auth/confirm`), ce qui
     exige un `?` déjà présent. La destination par défaut est donc écrite
     en clair plutôt que laissée au défaut de `/auth/confirm`.

     La liste blanche de Supabase doit couvrir ce `?` : une URL rejetée
     ne produit pas d'erreur, Supabase retombe en silence sur le « Site
     URL » — l'accueil. Avec `https://filloo.vercel.app/**`, l'adresse
     avec `?next=` est bien acceptée (journaux du 2026-09-25). */
  const apres = suite
    ? `/reinitialiser-mot-de-passe?next=${encodeURIComponent(suite)}`
    : "/reinitialiser-mot-de-passe";
  const redirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(apres)}`;
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
  if (error) return { error: messageErreurAuth(error.message) };

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
  if (!user?.email) return { error: "Connectez-vous d'abord." };

  if (!currentPassword) return { error: "Entrez votre mot de passe actuel." };
  const refus = await refusMotDePasse({ id: user.id, email: user.email }, currentPassword);
  if (refus) return { error: refus.incorrect ? "Mot de passe actuel incorrect." : refus.message };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: messageErreurAuth(error.message) };

  return { sent: true };
}

/**
 * « Créer un mot de passe » : pour un compte venu de Google, qui n'en a
 * aucun (demande du porteur du projet, 2026-11-11). Pas de mot de passe
 * actuel à vérifier : la preuve est une connexion Google de moins de dix
 * minutes, relue ICI dans le jeton signé — l'écran ne fait que l'annoncer.
 */
export async function createMyPasswordAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const newPassword = String(formData.get("newPassword") ?? "");
  const newPasswordConfirmation = String(formData.get("newPasswordConfirmation") ?? "");

  const erreurMotDePasse = erreurNouveauMotDePasse(newPassword, newPasswordConfirmation);
  if (erreurMotDePasse) return { error: erreurMotDePasse };

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user?.email) return { error: "Connectez-vous d'abord." };
  if (aUnMotDePasse(user)) return { error: "Votre compte a déjà un mot de passe : modifiez-le." };
  if (!(await connexionGoogleDeMoinsDeDixMinutes(supabase))) {
    return { error: "Par sécurité, confirmez d'abord avec Google, puis recommencez dans les 10 minutes." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: messageErreurAuth(error.message) };

  /* La marque qui fait passer l'écran à « Modifier ». Si elle échoue, le
     mot de passe est quand même créé : on le journalise, sans inquiéter
     la personne. */
  const { error: erreurMarque } = await createAdminClient().auth.admin.updateUserById(user.id, {
    app_metadata: { mot_de_passe_cree: true },
  });
  if (erreurMarque) console.error("[mot de passe cree]", erreurMarque.message);

  /* Pas de `revalidatePath` : l'écran passerait aussitôt à « Modifier »
     et le message de réussite disparaîtrait avec le formulaire. La
     prochaine visite de la page, dynamique, lira la marque. */
  return { sent: true };
}

/**
 * L'adresse de CE site, lue sur la requête — pour le retour de Google
 * seulement.
 *
 * `siteUrlOuLocalhost` renvoie toujours l'adresse de production : sur la
 * préversion de `dev`, Google ramènerait la personne sur `filloo.net`,
 * qui n'a pas la clé PKCE déposée en cookie sur la préversion, et
 * l'échange échouerait. Lire `Host` est sans danger ICI : Supabase ne suit
 * `redirectTo` que s'il figure dans sa liste « Redirect URLs » ; sinon il
 * renvoie vers la « Site URL ». Un `Host` forgé ne mène donc nulle part.
 */
async function origineDeLaRequete(): Promise<string> {
  const h = await headers();
  const hote = h.get("x-forwarded-host") ?? h.get("host");
  if (!hote) return siteUrlOuLocalhost();
  const protocole = h.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  return `${protocole}://${hote}`;
}

/**
 * « Continuer avec Google » (connexion ET inscription). Le retour passe
 * par `/auth/confirm?origine=google`, qui échange le code puis envoie une
 * connexion sans profil sur « Complétez votre compte » (`/inscription`).
 */
export async function googleSignInAction(formData: FormData): Promise<void> {
  const role = formData.get("role") === "merchant" ? "merchant" : formData.get("role") === "client" ? "client" : null;
  const next = safeNextPath(formData.get("next"));
  const retour = new URL("/auth/confirm", await origineDeLaRequete());
  retour.searchParams.set("origine", "google");
  if (role) retour.searchParams.set("role", role);
  if (next) retour.searchParams.set("next", next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: retour.toString() },
  });
  if (error || !data.url) {
    console.error("[google]", error?.message ?? "aucune adresse Google");
    redirect("/connexion?erreur=google");
  }
  redirect(data.url);
}

/**
 * « Complétez votre compte » : le PREMIER profil d'une connexion venue de
 * Google, qui n'en reçoit pas d'office (`0073`). Google donne le nom et
 * l'email ; le rôle et le téléphone se demandent ici.
 *
 * Insert direct, policy « profiles: je cree mon second compte » (0068) :
 * `auth_user_id` = la connexion, compte non suspendu, connexion ouverte.
 */
export async function completeSignupAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const role = formData.get("role") === "merchant" ? "merchant" : "client";
  const fullName = texteNettoye(formData.get("fullName"));
  const phone = String(formData.get("phone") ?? "").trim();

  const manquants = erreurChampsManquants([
    ["le nom complet", fullName],
    ["le téléphone", phone],
  ]);
  if (manquants) return { error: manquants };
  const erreurNomComplet = erreurNom(fullName, "Nom complet");
  if (erreurNomComplet) return { error: erreurNomComplet };
  const erreurNumero = erreurTelephone(phone, true);
  if (erreurNumero) return { error: erreurNumero };

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Votre session a expiré. Reconnectez-vous avec Google." };
  if ((await getMyProfiles(supabase)).length > 0) {
    redirect(await destinationApresAuthentification(supabase, formData.get("next")));
  }

  const { error } = await supabase
    .from("profiles")
    .insert({ auth_user_id: user.id, role, full_name: fullName, phone: nettoyerTelephone(phone) });
  if (error) {
    if (error.code === "23505") return { error: "Vous avez déjà ce type de compte." };
    return { error: messagePourErreur(error, "compte") };
  }

  await compter("inscription", { role });

  if (role === "merchant") redirect("/inscription/boutique");
  redirect(safeNextPath(formData.get("next")) ?? "/");
}
