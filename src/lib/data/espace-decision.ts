import type { Espace } from "@/lib/espace";

/**
 * QUI A LE DROIT D'ÊTRE OÙ — la décision, séparée de sa plomberie.
 *
 * Les gardes de `session.ts` dépendent de Supabase et du `redirect()` de
 * Next, donc d'une base joignable et d'un contexte de requête. Isolée ici,
 * la décision est une fonction pure de ses arguments, que
 * `scripts/verifier-gardes.mjs` peut vérifier.
 */

/** Ce qu'une garde a besoin de savoir d'un profil, et rien de plus. */
export type ProfilPourDecision = {
  role: Espace;
  isSuspended: boolean;
};

/**
 * `null` = laisser entrer. Une chaîne = le chemin où rediriger.
 *
 *   - AUCUN PROFIL → `/connexion`.
 *   - CLIENT SEUL → `/`, PAS `/connexion` : renvoyer vers l'écran de
 *     connexion quelqu'un de DÉJÀ connecté lui demande de refaire ce qu'il
 *     a fait, et il tourne en rond. On le ramène chez lui.
 *   - COMMERÇANT SUSPENDU → `/compte/suspendu` : la suspension frappe le
 *     PROFIL et coupe l'écriture, pas la lecture du catalogue.
 *   - COMMERÇANT ACTIF → `null`.
 *
 * Le statut de la BOUTIQUE (`pending`, `rejected`) ne se regarde pas ici :
 * `/vendeur/attente` et `/vendeur/refusee` vivent DANS cet espace et
 * doivent rester joignables.
 */
export function refusEspaceCommercant(profils: ProfilPourDecision[]): string | null {
  const commercant = profils.find((p) => p.role === "merchant");
  if (!commercant) return profils.length > 0 ? "/" : "/connexion";
  if (commercant.isSuspended) return "/compte/suspendu";
  return null;
}

/**
 * Le pendant client, pour les écrans qui exigent un compte (`/compte`,
 * `/messages`) ; le catalogue public n'est pas derrière cette porte.
 *
 * L'asymétrie avec la fonction ci-dessus est voulue : une connexion
 * commerçant-seule qui demande `/compte` part sur `/vendeur/boutique`, son
 * propre écran de compte, et non sur `/connexion`.
 */
export function refusEspaceClient(profils: ProfilPourDecision[]): string | null {
  const client = profils.find((p) => p.role === "client");
  if (!client) {
    return profils.some((p) => p.role === "merchant") ? "/vendeur/boutique" : "/connexion";
  }
  if (client.isSuspended) return "/compte/suspendu";
  return null;
}
