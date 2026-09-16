import type { Espace } from "@/lib/espace";

/**
 * QUI A LE DROIT D'ÊTRE OÙ — la décision, séparée de sa plomberie.
 *
 * POURQUOI CE FICHIER EXISTE
 * Les gardes d'espace vivent dans `session.ts`, où elles interrogent
 * Supabase puis appellent `redirect()` de Next. Ces deux dépendances les
 * rendent très difficiles à tester : il faut une base joignable et un
 * contexte de requête Next. Résultat prévisible — la règle la plus
 * importante de l'arborescence n'aurait été vérifiée par rien, exactement
 * comme la colonne `valider` de 0018 n'a été testée par rien pendant
 * qu'elle tournait en production.
 *
 * La décision, elle, ne dépend d'aucun des deux : « étant donné les
 * profils de cette connexion, cette personne peut-elle entrer dans cet
 * espace, et sinon où l'envoyer ? » est une fonction pure de ses
 * arguments. On l'isole donc ici, et `session.ts` ne garde que le trajet
 * jusqu'à la base et le `redirect`.
 *
 * C'est la même leçon que la partie 4 de 0002, appliquée au code : une
 * protection qu'on ne peut pas prouver est une protection en laquelle on
 * ne devrait pas avoir confiance.
 */

/** Ce qu'une garde a besoin de savoir d'un profil, et rien de plus. */
export type ProfilPourDecision = {
  role: Espace;
  isSuspended: boolean;
};

/**
 * `null` = laisser entrer. Une chaîne = le chemin où rediriger.
 *
 * Les quatre cas, et pourquoi chacun est ce qu'il est :
 *
 *   - AUCUN PROFIL → `/connexion`. Personne n'est connecté.
 *   - CLIENT SEUL → `/`, PAS `/connexion`. C'est la distinction qui a
 *     déjà mordu ce projet dans l'autre sens (voir `clientSpaceFallback`) :
 *     renvoyer vers l'écran de connexion quelqu'un de DÉJÀ connecté lui
 *     demande de refaire ce qu'il a fait, et il tourne en rond. Un client
 *     authentifié n'a pas à se reconnecter pour apprendre que cet espace
 *     n'est pas le sien — on le ramène chez lui.
 *   - COMMERÇANT SUSPENDU → `/compte/suspendu`. La suspension frappe le
 *     PROFIL et coupe l'écriture, pas la lecture du catalogue.
 *   - COMMERÇANT ACTIF → `null`.
 *
 * Le statut de la BOUTIQUE (`pending`, `rejected`) ne se regarde pas ici,
 * volontairement : `/vendeur/attente` et `/vendeur/refusee` vivent DANS
 * cet espace et doivent rester joignables — ce sont les écrans qui
 * expliquent à une boutique non validée où elle en est.
 */
export function refusEspaceCommercant(profils: ProfilPourDecision[]): string | null {
  const commercant = profils.find((p) => p.role === "merchant");
  if (!commercant) return profils.length > 0 ? "/" : "/connexion";
  if (commercant.isSuspended) return "/compte/suspendu";
  return null;
}

/**
 * Le pendant client, pour les écrans qui exigent un compte (`/compte`,
 * `/messages`). Le catalogue public n'est PAS derrière cette porte : il
 * se lit sans compte, et c'est une décision du projet.
 *
 * L'asymétrie avec la fonction ci-dessus est donc voulue, et c'est le
 * seul endroit où elle est écrite noir sur blanc : une connexion
 * commerçant-seule qui demande `/compte` part sur `/vendeur/boutique`,
 * son propre écran de compte — pas sur `/connexion`.
 */
export function refusEspaceClient(profils: ProfilPourDecision[]): string | null {
  const client = profils.find((p) => p.role === "client");
  if (!client) {
    return profils.some((p) => p.role === "merchant") ? "/vendeur/boutique" : "/connexion";
  }
  if (client.isSuspended) return "/compte/suspendu";
  return null;
}
