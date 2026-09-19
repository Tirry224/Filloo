/**
 * La forme d'un numéro guinéen, écrite une fois.
 *
 * POURQUOI CE FICHIER EXISTE
 * Cinq endroits enregistrent un numéro — l'inscription client,
 * l'inscription commerçant, « Mes informations », la création de boutique
 * et sa modification — et aucun ne vérifiait autre chose que « le champ
 * n'est pas vide ». Un numéro à sept chiffres, une adresse email tapée
 * dans le mauvais champ ou un « je sais pas » partaient donc en base sans
 * un mot. Or ce numéro est le SEUL moyen de joindre quelqu'un sur Makiti :
 * un commerçant validé qu'on ne peut pas appeler est un commerçant perdu,
 * et la validation d'une boutique se fait justement par un appel.
 *
 * POURQUOI CÔTÉ SERVEUR, ET PAS SEULEMENT UN `pattern` HTML
 * Un attribut `pattern` prévient plus tôt, ce qui est confortable, mais
 * une requête forgée ne passe par aucun champ. La seule vérification qui
 * compte est celle qui a lieu dans l'action serveur — c'est la même
 * logique que `src/lib/password.ts`, et pour la même raison.
 *
 * CE QUE CETTE RÈGLE NE FAIT PAS
 * Elle ne prouve rien. Le numéro n'est pas vérifié par SMS (décision 1 de
 * `docs/SPEC.md`) : il sert à joindre quelqu'un, pas à l'authentifier.
 * Elle écarte les fautes de frappe évidentes, et c'est tout ce qu'on peut
 * honnêtement faire ici.
 */

/**
 * Retire ce qu'une personne ajoute naturellement en tapant son numéro :
 * espaces, points, tirets, parenthèses, et l'indicatif pays sous ses deux
 * écritures.
 *
 * On NORMALISE avant d'enregistrer, pas seulement avant de vérifier. Deux
 * lignes qui contiennent « 622 33 44 55 » et « +224622334455 » désignent
 * le même abonné mais ne se comparent pas, et le jour où l'on construira
 * un lien `wa.me` il faudra un format unique — le choisir maintenant coûte
 * une ligne, le rattraper plus tard coûtera une migration.
 */
export function nettoyerTelephone(valeur: string): string {
  return valeur
    .replace(/[\s.\-()]/g, "")
    .replace(/^\+224/, "")
    .replace(/^00224/, "");
}

/**
 * Un mobile guinéen : neuf chiffres commençant par 6.
 *
 * Volontairement strict sur la forme. Les quatre opérateurs du pays
 * émettent tous des numéros en `6…` à neuf chiffres ; accepter autre
 * chose reviendrait à n'accepter que ce qui ne marche pas.
 */
export function estTelephone(valeur: string): boolean {
  return /^6\d{8}$/.test(nettoyerTelephone(valeur));
}

/**
 * `null` = le numéro est acceptable. Une chaîne = le message à afficher,
 * déjà écrit en français pour être lu tel quel.
 *
 * Le message dit QUOI FAIRE et non ce qui est faux : « Numéro invalide »
 * laisse la personne deviner s'il manque un chiffre ou s'il en faut un de
 * moins.
 *
 * `obligatoire` distingue les deux cas réels du produit : le téléphone
 * d'un compte l'est — c'est par là qu'on rappelle —, le WhatsApp d'une
 * boutique ne l'est pas, parce que tous les commerçants n'en ont pas.
 * Vide et non obligatoire passe ; vide et obligatoire ne passe pas.
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
