/**
 * Les refus de Supabase Auth, traduits pour la personne qui les lit.
 * Supabase répond en anglais, et un refus non traduit tombait dans « Une
 * erreur est survenue » : la personne réessayait à l'identique, sans
 * savoir quoi changer. Hors de `src/lib/actions/` pour servir aussi à
 * `src/lib/supabase/verify.ts` et être testé (`tests/erreurs-auth.test.ts`).
 */

export function messageErreurAuth(message: string): string {
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Un compte existe déjà avec cet email. Connectez-vous : vous pourrez ajouter votre second compte depuis « Mon compte », sans changer d'adresse.";
  }
  if (message.includes("Email not confirmed")) {
    return "Votre adresse email n'est pas encore confirmée. Ouvrez le lien reçu par email (pensez aux courriers indésirables).";
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
    return `Le mot de passe doit faire au moins ${longueur[1]} caractères.`;
  }
  /* Règles réglées au tableau de bord Supabase (Authentication → Sign In
     / Providers → Email), pas dans le code : sans ces deux cas, un mot de
     passe refusé pour sa composition tombait dans « Une erreur est
     survenue » — constaté le 2026-09-25 sur la réinitialisation. */
  if (message.includes("should contain at least one character")) {
    return "Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre.";
  }
  if (message.includes("known to be weak") || message.includes("easy to guess")) {
    return "Ce mot de passe figure dans des listes de mots de passe piratés. Choisissez-en un autre.";
  }
  if (message.includes("should be different from the old password")) {
    return "Le nouveau mot de passe doit être différent de l'actuel.";
  }
  if (message.includes("validate email") || message.includes("invalid format")) {
    return "Cette adresse email n'est pas valide. Vérifiez-la (exemple : mariama@exemple.com).";
  }
  /* `deleteAccountAction` BANNIT la connexion au lieu de la supprimer
     (voir `account.ts`) : c'est donc aussi ce que lit quelqu'un qui a
     supprimé son compte, pas seulement un compte sanctionné. */
  if (message.includes("banned")) {
    return "Ce compte a été supprimé ou fermé. Si vous pensez qu'il s'agit d'une erreur, écrivez-nous depuis la page Contact.";
  }
  /* « For security purposes, you can only request this after 39
     seconds » : trop de demandes d'email (inscription, renvoi du lien) en
     peu de temps. Tombait dans le message générique, sans dire combien de
     temps attendre (treize fois le 2026-10-22). */
  const attente = message.match(/only request this after (\d+) seconds?/);
  if (attente) {
    return `Trop de demandes en peu de temps. Patientez ${attente[1]} secondes, puis réessayez.`;
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Trop d'essais en peu de temps. Patientez quelques minutes, puis réessayez.";
  }
  /* Tout le reste s'affichait tel quel, en anglais. Le texte d'origine
     part dans les journaux, où il sert. */
  console.error("[auth]", message);
  return "Une erreur est survenue. Réessayez dans un instant.";
}
