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
    // Un simple « essayez de vous connecter » produisait des connexions
    // distinctes au lieu d'un second profil lié : qui veut « aussi vendre »
    // lit « compte déjà pris » et repart avec un deuxième email. Dire la
    // suite évite un compte en trop, qu'on ne peut plus fusionner.
    return "Un compte existe déjà avec cet email. Connectez-vous : vous pourrez ajouter votre second compte depuis « Mon compte », sans changer d'adresse.";
  }
  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("Password should be at least")) {
    // Le chiffre vient de la même constante que nos propres contrôles :
    // Supabase impose son minimum, nous le nôtre, et deux textes qui
    // annoncent des longueurs différentes rendraient le refus incompréhensible.
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
  /* Le numéro est vérifié AVANT la création du compte : corrigé après
     coup, il l'est dans « Mes informations », un écran que personne ne
     rouvre spontanément. Un compte créé avec un numéro injoignable le
     reste. */
  const erreurNumero = erreurTelephone(phone, true);
  if (erreurNumero) return { error: erreurNumero };
  /* Double saisie : c'est le seul champ du parcours qu'on ne peut pas
     relire, et mal tapé il enferme dehors — la faute ne se découvre qu'à la
     connexion suivante et coûte une réinitialisation par email, sur un
     réseau où recevoir cet email n'est pas acquis. */
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
  // (réglage du tableau de bord Supabase) : le compte existe déjà côté
  // auth.users, mais aucune connexion n'est active tant que le lien reçu
  // par email n'a pas été cliqué. Impossible d'aller plus loin dans l'app
  // dans ce cas — on le dit plutôt que de rediriger vers un écran qui
  // échouerait faute de session.
  if (!data.session) return { needsConfirmation: true };

  if (role === "merchant") redirect("/inscription/boutique");
  // `next` porte l'intention qui a mené ici — presque toujours
  // « contacter ce vendeur » (écran 16). Voir `safeNextPath`, qui refuse
  // tout ce qui n'est pas une adresse interne.
  redirect(safeNextPath(formData.get("next")) ?? "/");
}

/**
 * Créer le SECOND compte lié (écran 12, en étant déjà connecté) : pas de
 * mot de passe à saisir, c'est la même connexion — juste un nouveau profil
 * (policy « profiles: je cree mon second compte », 0002).
 *
 * LE NOM ET LE TÉLÉPHONE NE SE SAISISSENT PLUS ICI, ILS SE RECOPIENT. Ils
 * appartiennent à la connexion, pas au rôle : les redemander revenait à
 * proposer d'en donner d'autres, et c'est ainsi que les deux profils d'une
 * même personne divergeaient dès leur création.
 *
 * ET C'EST AUSSI UNE QUESTION DE SÉCURITÉ : propager les valeurs SAISIES
 * ICI vers le profil existant ouvrirait un contournement de la
 * confirmation par mot de passe — un téléphone emprunté trente secondes,
 * un second compte créé, et le nom comme le numéro du premier réécrits
 * sans rien connaître du compte. Recopier ce qui est déjà en base ne peut
 * rien réécrire.
 */
export async function createLinkedProfileAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const role = formData.get("role") === "merchant" ? "merchant" : "client";

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Vous devez être connecté." };

  /* L'identité vient du profil existant, jamais du formulaire. S'il n'y
     en a pas, c'est qu'on n'est pas dans le cas « second compte » —
     `/inscription` aurait affiché le mode `new` — et il n'y a rien à
     recopier. */
  const profiles = await getMyProfiles(supabase);
  const existant = profiles.find((p) => !p.isDeleted);
  if (!existant) return { error: "Aucun compte à lier. Reconnectez-vous, puis réessayez." };

  const { error } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: user.id,
      role,
      full_name: existant.fullName,
      /* Déjà normalisé au moment où il a été écrit : le repasser par
         `nettoyerTelephone` ne changerait rien, et laisserait croire que
         cette valeur vient d'être saisie. */
      phone: existant.phone,
    });
  if (error) {
    if (error.code === "23505") return { error: "Vous avez déjà ce type de compte." };
    return { error: error.message };
  }

  if (role === "merchant") redirect("/inscription/boutique");
  // Même reprise d'intention que pour une inscription complète : une
  // connexion qui n'avait qu'un compte commerçant vient peut-être de
  // créer son compte client POUR écrire à un vendeur.
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

  /* Où atterrir. Jamais `/` en dur : une connexion commerçant-seul
     atterrissait sur le fil client avec sa barre d'onglets, ce que la
     décision 8 de SPEC interdit — `landingForSession` tranche.

     `next` est suivi s'il appartient à l'espace autorisé : le jeter dès que
     l'atterrissage n'était pas « / » faisait perdre à un commerçant le lien
     qu'il venait ouvrir, depuis que le middleware pose lui-même `?next=` sur
     `/vendeur/*`. Une connexion commerçant-seul ne suit donc `next` que sous
     `/vendeur` ; un paramètre d'URL ne défait pas la décision 8, il choisit
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
  // `sent: true` DANS TOUS LES CAS, échec compris : répondre autre chose
  // pour une adresse inconnue dirait à un inconnu qui a un compte ici.
  // C'est la protection contre l'énumération des comptes, et elle ne bouge
  // pas. L'erreur, elle, se journalise : l'échec attendu est le quota du
  // serveur mail, et c'est dans les journaux qu'on le constate.
  if (error) console.error("resetPasswordForEmail a échoué :", error.message);
  return { sent: true };
}

/** Nouveau mot de passe — après le lien de /mot-de-passe-oublie. Suppose
 * une session "recovery" déjà active (échangée par /auth/confirm). */
export async function updatePasswordAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");

  /* La double saisie compte DOUBLE ici : cet écran s'ouvre depuis un lien
     reçu par email, et ce lien ne sert qu'une fois. Un mot de passe mal
     tapé ici oblige à redemander un email, donc à refaire tout le trajet
     — pour une frappe qu'on n'a jamais pu relire. */
  const erreurMotDePasse = erreurNouveauMotDePasse(password, passwordConfirmation);
  if (erreurMotDePasse) return { error: erreurMotDePasse };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translateAuthError(error.message) };

  // Même aiguillage qu'après une connexion : changer son mot de passe
  // n'est pas une raison d'atterrir dans l'espace de quelqu'un d'autre.
  redirect(await landingForSession(supabase));
}

/**
 * Changer son mot de passe depuis son compte, en le CONNAISSANT.
 *
 * POURQUOI UNE ACTION DE PLUS, ET PAS `updatePasswordAction` : celle du
 * dessus sert la réinitialisation par email, où la preuve est le lien reçu
 * dans la boîte ; ici aucun email n'est envoyé, la seule preuve disponible
 * est le mot de passe actuel. Deux preuves différentes, donc deux actions —
 * les fondre rendrait le contrôle facultatif, c'est-à-dire inexistant.
 *
 * CE QUE ÇA EMPÊCHE : un téléphone déverrouillé emprunté trente secondes.
 * Sans ce contrôle, changer le mot de passe de quelqu'un ferme la porte
 * derrière soi — le propriétaire ne peut plus entrer, et la
 * réinitialisation ne le sauve que s'il a encore accès à sa boîte.
 */
export async function changeMyPasswordAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const newPasswordConfirmation = String(formData.get("newPasswordConfirmation") ?? "");

  /* L'ordre des contrôles suit le coût pour la personne : la forme du
     nouveau mot de passe d'abord, qui ne coûte rien à vérifier, le mot de
     passe actuel ensuite, qui demande un aller-retour à Supabase. Refuser
     tôt ce qui se refuse sans réseau. */
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

  /* Pas de redirection : le formulaire vit dans un panneau posé sur
     l'écran de compte, et renvoyer ailleurs donnerait l'impression d'avoir
     perdu sa place. On rend un succès, le panneau le dit, la personne
     referme. */
  return { sent: true };
}
