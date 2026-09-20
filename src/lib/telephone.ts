/**
 * La forme d'un numéro guinéen, écrite une fois.
 *
 * POURQUOI CE FICHIER EXISTE
 * Cinq endroits enregistrent un numéro et aucun ne vérifiait plus que
 * « le champ n'est pas vide ». Or ce numéro est le SEUL moyen de joindre
 * quelqu'un sur Makiti : un commerçant validé qu'on ne peut pas appeler
 * est un commerçant perdu, et la validation d'une boutique se fait
 * justement par un appel.
 *
 * POURQUOI CÔTÉ SERVEUR, ET PAS SEULEMENT UN `pattern` HTML
 * Un `pattern` prévient plus tôt, mais une requête forgée ne passe par
 * aucun champ : la seule vérification qui compte est celle de l'action
 * serveur — même logique que `src/lib/password.ts`.
 *
 * CE QUE CETTE RÈGLE NE FAIT PAS
 * Elle ne prouve rien : le numéro n'est pas vérifié par SMS (décision 1
 * de `docs/SPEC.md`), il sert à joindre quelqu'un, pas à l'authentifier.
 * Elle écarte les fautes de frappe évidentes, rien de plus.
 */

/**
 * Retire ce qu'une personne ajoute en tapant son numéro : espaces,
 * points, tirets, parenthèses, et l'indicatif pays sous ses deux
 * écritures.
 *
 * On NORMALISE avant d'enregistrer, pas seulement avant de vérifier :
 * « 622 33 44 55 » et « +224622334455 » désignent le même abonné mais ne
 * se comparent pas, et un lien `wa.me` exigera un format unique — le
 * rattraper plus tard coûterait une migration.
 */
export function nettoyerTelephone(valeur: string): string {
  return valeur
    .replace(/[\s.\-()]/g, "")
    .replace(/^\+224/, "")
    .replace(/^00224/, "");
}

/**
 * Un mobile guinéen : neuf chiffres commençant par 6. Volontairement
 * strict — les quatre opérateurs du pays émettent tous ce format, donc
 * accepter autre chose reviendrait à accepter ce qui ne marche pas.
 */
export function estTelephone(valeur: string): boolean {
  return /^6\d{8}$/.test(nettoyerTelephone(valeur));
}

/**
 * `null` = le numéro est acceptable. Une chaîne = le message à afficher,
 * déjà écrit en français pour être lu tel quel.
 *
 * Le message dit QUOI FAIRE et non ce qui est faux : « Numéro invalide »
 * laisse deviner s'il manque un chiffre ou s'il en faut un de moins.
 *
 * `obligatoire` distingue les deux cas réels : le téléphone d'un compte
 * l'est — c'est par là qu'on rappelle —, le WhatsApp d'une boutique non,
 * tous les commerçants n'en ayant pas.
 */
export function erreurTelephone(valeur: string, obligatoire: boolean, champ = "téléphone"): string | null {
  const nettoye = nettoyerTelephone(valeur);
  if (!nettoye) {
    return obligatoire ? `Entrez votre numéro de ${champ}.` : null;
  }
  if (!estTelephone(nettoye)) {
    return `Entrez un numéro guinéen à 9 chiffres commençant par 6 (exemple : 622 33 44 55).`;
  }
  return null;
}
