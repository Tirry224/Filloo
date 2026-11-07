/**
 * Le cookie de mesure des visiteurs uniques (décision du porteur du
 * projet, 2026-11-07 ; migration 0057, politique de confidentialité
 * art. 4).
 *
 * Un numéro tiré au hasard par navigateur, posé par `middleware.ts`.
 * Jamais relié à un profil, une IP ou un agent utilisateur : il dit
 * seulement « ce navigateur est déjà venu ». Pourquoi pas l'adresse IP :
 * les opérateurs guinéens font passer des centaines de téléphones par la
 * même, ce qui fondrait des inconnus en un seul visiteur.
 */
export const COOKIE_VISITEUR = "filloo_v";

/** 13 mois, comme la purge des mesures (0028). */
export const DUREE_COOKIE_VISITEUR = 60 * 60 * 24 * 395;

const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Le numéro, s'il a la bonne forme ; un cookie bricolé est ignoré, pas
 * refusé : la mesure part sans visiteur plutôt que pas du tout. */
export function lireVisiteur(valeur: string | undefined): string | null {
  return valeur && FORME_UUID.test(valeur) ? valeur : null;
}
