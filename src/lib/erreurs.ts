/**
 * Ce que la personne lit quand la base refuse.
 *
 * Avant, dix-huit `return { error: error.message }` affichaient le texte
 * BRUT de PostgreSQL ou de Supabase : « insert or update on table
 * "products" violates foreign key constraint… », « invalid input syntax
 * for type uuid », « new row for relation "messages" violates check
 * constraint… » — en anglais, et en nommant nos tables. Constaté le
 * 2026-09-25 en forgeant des formulaires et en tapant trop long.
 *
 * Seuls les refus ÉCRITS POUR ÊTRE LUS passent tels quels : les
 * `raise exception` de nos triggers (code P0001), rédigés en français
 * dans les migrations. Tout le reste se traduit par sa CAUSE probable, et
 * le texte d'origine part dans les journaux, où il sert.
 */

type ErreurBase = { code?: string | null; message: string };

export const DECONNECTE = "Vous avez été déconnecté. Reconnectez-vous, puis réessayez : votre saisie est gardée.";

export const ERREUR_INCONNUE = "Une erreur est survenue. Réessayez dans un instant.";

export function messagePourErreur(erreur: ErreurBase, contexte = "action"): string {
  switch (erreur.code) {
    case "P0001":
      return erreur.message;
    case "22P02": // un identifiant ou un nombre mal formé
    case "23503": // une catégorie, une ville ou un produit qui n'existe pas
      console.error(`[${contexte}]`, erreur.code, erreur.message);
      return "Ce formulaire n'est plus à jour. Rechargez la page, puis réessayez.";
    case "23514": // une contrainte `check` : longueur, borne
      console.error(`[${contexte}]`, erreur.code, erreur.message);
      return "Un des champs dépasse ce qui est permis. Raccourcissez-le, puis réessayez.";
    case "42501": // RLS : session expirée, compte suspendu ou supprimé
      console.error(`[${contexte}]`, erreur.code, erreur.message);
      return "Action refusée. Reconnectez-vous, puis réessayez.";
    default:
      console.error(`[${contexte}]`, erreur.code ?? "", erreur.message);
      return ERREUR_INCONNUE;
  }
}
