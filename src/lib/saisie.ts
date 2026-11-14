/**
 * Les règles communes aux champs de TEXTE libre et aux identifiants, à
 * appliquer CÔTÉ SERVEUR : une requête forgée ne passe par aucun
 * `maxLength` HTML.
 */

/**
 * Caractères qui ne s'affichent pas, ou qui retournent l'affichage :
 * espaces de largeur nulle (U+200B–U+200D, U+2060, U+FEFF), marques et
 * forçages de direction (U+200E–U+200F, U+202A–U+202E, U+2066–U+2069).
 *
 * Constaté le 2026-09-25 : trois U+200B faisaient un nom, un nom de
 * boutique, un titre de produit ou un message « non vides » qui
 * s'affichaient vides ; et U+202E faisait lire « live » là où l'on avait
 * écrit « evil » — de quoi maquiller le nom d'une boutique. L'arabe et le
 * n'ko s'écrivent de droite à gauche SANS ces caractères : les retirer ne
 * prive personne de sa langue.
 */
const INVISIBLES = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Le texte tel qu'on l'enregistre : sans invisibles, sans espaces de bord. */
export function texteNettoye(valeur: unknown): string {
  return String(valeur ?? "").replace(INVISIBLES, "").trim();
}

/** La longueur d'un texte en CARACTÈRES, comme la compte PostgreSQL
 * (`length`), et non en unités UTF-16 comme `String.length` : un emoji
 * compte pour un. */
export function longueur(texte: string): number {
  return [...texte].length;
}

/**
 * Un nom de personne ou de boutique : ce qu'un autre lira dans une liste.
 * Rien ne bornait sa longueur ; 5 000 caractères passaient (2026-09-25).
 */
export const NOM_MIN = 2;
export const NOM_MAX = 80;

export function erreurNom(nom: string, champ: string): string | null {
  const n = longueur(nom);
  if (n < NOM_MIN) return `${champ} : ${NOM_MIN} caractères minimum.`;
  if (n > NOM_MAX) return `${champ} : ${NOM_MAX} caractères maximum.`;
  return null;
}

/**
 * Le refus d'un formulaire dont des champs obligatoires sont vides :
 * il nomme CEUX qui manquent, et eux seuls. Un message figé (« Nom de la
 * boutique et ville obligatoires. ») accusait le nom alors que seule la
 * ville manquait (2026-11-03). Chaque champ arrive avec son article :
 * `["la ville", cityId]`. Rend `null` quand tout est rempli.
 */
export function erreurChampsManquants(champs: ReadonlyArray<readonly [libelle: string, valeur: unknown]>): string | null {
  const manquants = champs.filter(([, valeur]) => !valeur).map(([libelle]) => libelle);
  if (manquants.length === 0) return null;
  const liste =
    manquants.length === 1 ? manquants[0] : `${manquants.slice(0, -1).join(", ")} et ${manquants[manquants.length - 1]}`;
  return `Il manque ${liste}.`;
}

/** Un refus de formulaire : le message, et le champ (son `name`) sous
 * lequel l'afficher. Sans `champ`, il reste au pied du formulaire. */
export type Refus = { error: string; champ?: string };

/**
 * `erreurChampsManquants`, avec le `name` de chaque champ : le message
 * nomme tous les manquants et s'affiche sous le PREMIER, celui que
 * l'écran montre en remontant.
 */
export function refusChampsManquants(
  champs: ReadonlyArray<readonly [libelle: string, valeur: unknown, champ: string]>,
): Refus | null {
  const error = erreurChampsManquants(champs.map(([libelle, valeur]) => [libelle, valeur] as const));
  if (!error) return null;
  return { error, champ: champs.find(([, valeur]) => !valeur)?.[2] };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Un identifiant venu de l'URL ou d'un formulaire. Tout ce qui n'a pas
 * cette forme est refusé AVANT la base : sinon PostgreSQL répond `22P02`,
 * que les pages relançaient — `/produit/abc` donnait une erreur 500 au
 * lieu d'une page introuvable (2026-09-25).
 */
export function estUuid(valeur: unknown): valeur is string {
  return typeof valeur === "string" && UUID.test(valeur);
}

/** Un identifiant de catégorie ou de ville : un entier strictement
 * positif. `Number("1.5")` ou `Number("-3")` passaient le `!categoryId` et
 * la base répondait en anglais. */
export function lireIdEntier(valeur: unknown): number | null {
  const texte = String(valeur ?? "").trim();
  if (!/^\d{1,9}$/.test(texte)) return null;
  const n = Number(texte);
  return n > 0 ? n : null;
}

/** Les précisions d'un signalement. `reports.reason` (0001) est borné à
 * 1 000 caractères, motif compris : 5 000 caractères faisaient répondre
 * la base en anglais, dans la bannière de l'écran (2026-09-25). */
export const PRECISIONS_MAX = 900;
