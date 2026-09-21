/**
 * La forme d'un numéro guinéen, écrite une fois pour les cinq endroits qui
 * enregistrent un numéro. À appliquer CÔTÉ SERVEUR : une requête forgée ne
 * passe par aucun `pattern` HTML.
 *
 * Elle ne prouve rien — le numéro n'est pas vérifié par SMS (décision 1 de
 * `docs/SPEC.md`) — et écarte seulement les fautes de frappe.
 */

/**
 * Retire espaces, points, tirets, parenthèses et l'indicatif pays sous ses
 * deux écritures.
 *
 * On normalise avant d'ENREGISTRER, pas seulement avant de vérifier :
 * « 622 33 44 55 » et « +224622334455 » doivent se comparer, et `wa.me`
 * exige un format unique. Rattraper plus tard coûterait une migration.
 */
export function nettoyerTelephone(valeur: string): string {
  return valeur
    .replace(/[\s.\-()]/g, "")
    .replace(/^\+224/, "")
    .replace(/^00224/, "");
}

/** Un mobile guinéen : neuf chiffres commençant par 6, le seul format émis
 * par les quatre opérateurs du pays. */
export function estTelephone(valeur: string): boolean {
  return /^6\d{8}$/.test(nettoyerTelephone(valeur));
}

/**
 * `null` = acceptable. Une chaîne = le message à afficher tel quel ; il dit
 * quoi faire, pas ce qui est faux.
 *
 * `obligatoire` : le téléphone d'un compte l'est, le WhatsApp d'une
 * boutique non — tous les commerçants n'en ont pas.
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
