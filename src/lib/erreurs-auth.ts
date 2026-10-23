/**
 * Les refus de Supabase Auth, traduits pour la personne qui les lit.
 * Supabase répond en anglais, et un refus non traduit tombait dans « Une
 * erreur est survenue » : la personne réessayait à l'identique, sans
 * savoir quoi changer. Hors de `src/lib/actions/` pour servir aussi à
 * `src/lib/supabase/verify.ts` et être testé (`tests/erreurs-auth.test.ts`).
 */

export function messageErreurAuth(message: string): string {
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Cet email a déjà un compte. Connectez-vous.";
  }
  if (message.includes("Email not confirmed")) {
    return "Email pas encore confirmé. Ouvrez le lien reçu (voyez aussi les indésirables).";
  }
  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  /* Le chiffre se lit DANS la réponse : c'est le réglage de Supabase qui
     décide, pas la constante du site. Le 2026-10-22, Supabase exigeait 10
     et le site traduisait par « 8 caractères minimum » : six inscriptions
     refusées de suite, chaque fois avec ce même message faux. */
  const longueur = message.match(/Password should be at least (\d+)/);
  if (longueur) {
    return `Mot de passe trop court : ${longueur[1]} caractères minimum, dont un chiffre.`;
  }
  /* Règles réglées au tableau de bord Supabase (Authentication → Sign In
     / Providers → Email), pas dans le code : sans ces deux cas, un mot de
     passe refusé pour sa composition tombait dans « Une erreur est
     survenue » — constaté le 2026-09-25 sur la réinitialisation. */
  if (message.includes("should contain at least one character")) {
    return "Mot de passe trop simple : ajoutez une minuscule, une majuscule et un chiffre.";
  }
  if (message.includes("known to be weak") || message.includes("easy to guess")) {
    return "Mot de passe trop connu des pirates. Choisissez-en un autre.";
  }
  if (message.includes("should be different from the old password")) {
    return "Choisissez un mot de passe différent de l'actuel.";
  }
  if (message.includes("validate email") || message.includes("invalid format")) {
    return "Email invalide. Exemple : mariama@exemple.com.";
  }
  /* `deleteAccountAction` BANNIT la connexion au lieu de la supprimer
     (voir `account.ts`) : c'est donc aussi ce que lit quelqu'un qui a
     supprimé son compte, pas seulement un compte sanctionné. */
  if (message.includes("banned")) {
    return "Compte supprimé ou fermé. Écrivez-nous depuis la page Contact.";
  }
  /* « For security purposes, you can only request this after 39
     seconds » : trop de demandes d'email (inscription, renvoi du lien) en
     peu de temps. Tombait dans le message générique, sans dire combien de
     temps attendre (treize fois le 2026-10-22). */
  const attente = message.match(/only request this after (\d+) seconds?/);
  if (attente) {
    return `Trop d'essais. Réessayez dans ${attente[1]} secondes.`;
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Trop d'essais. Réessayez dans quelques minutes.";
  }
  /* Tout le reste s'affichait tel quel, en anglais. Le texte d'origine
     part dans les journaux, où il sert. */
  console.error("[auth]", message);
  return "Une erreur est survenue. Réessayez.";
}
