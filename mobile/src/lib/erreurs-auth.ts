/**
 * Recopié de `translateAuthError` (`src/lib/actions/auth.ts` du site) :
 * l'app ne partage pas de code avec le site, par choix du porteur du
 * projet. Un message changé là-bas se change ici aussi.
 */
const LONGUEUR_MIN_MOT_DE_PASSE = 8;

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
  if (message.includes("Password should be at least")) {
    return `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum pour le mot de passe.`;
  }
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
  if (message.includes("banned")) {
    return "Ce compte a été supprimé ou fermé. Si vous pensez qu'il s'agit d'une erreur, écrivez-nous depuis la page Contact.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Trop d'essais en peu de temps. Patientez quelques minutes, puis réessayez.";
  }
  /* Sur un téléphone, la cause la plus fréquente : pas de réseau. */
  if (message.includes("Network request failed")) {
    return "Pas de connexion internet. Vérifiez votre réseau, puis réessayez.";
  }
  console.error("[auth]", message);
  return "Une erreur est survenue. Réessayez dans un instant.";
}
