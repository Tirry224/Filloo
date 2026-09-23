/**
 * La forme d'un numéro guinéen, écrite une fois pour les cinq endroits qui
 * enregistrent un numéro. À appliquer CÔTÉ SERVEUR : une requête forgée ne
 * passe par aucun `pattern` HTML.
 *
 * Elle ne prouve rien — le numéro n'est pas vérifié par SMS (décision 1 de
 * `docs/SPEC.md`) — et écarte seulement les fautes de frappe.
 */

/**
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

/**
 * L'indicatif de la Guinée. Les numéros sont ENREGISTRÉS sans lui —
 * `nettoyerTelephone` le retire pour que « 622 33 44 55 » et
 * « +224622334455 » se comparent — mais tout ce qui SORT de
 * l'application doit le reposer : un numéro national ne désigne personne
 * hors du pays.
 */
export const INDICATIF_GUINEE = "224";

/**
 * Le numéro est REVALIDÉ ici plutôt que supposé propre : il vient de la
 * base, où il a pu être écrit avant que `erreurTelephone` n'existe, ou à
 * la main depuis le tableau de bord. Un lien vers un numéro fautif est
 * pire que pas de lien.
 */
export function lienWhatsApp(numero: string | null | undefined): string | null {
  if (!numero) return null;
  const nettoye = nettoyerTelephone(numero);
  if (!estTelephone(nettoye)) return null;
  return `https://wa.me/${INDICATIF_GUINEE}${nettoye}`;
}
