import type { User } from "@supabase/supabase-js";

/**
 * Le compte du porteur du projet : celui qui voit `/admin`, et SEULEMENT
 * `/admin` (règle du 2026-10-07 — ce compte ne navigue plus dans l'app
 * comme un utilisateur ; `/admin` remplace `/suivi` depuis le
 * 2026-11-05). Lu par le middleware, par `getMyProfiles` et par
 * `requireEquipe`, qui l'inscrit dans l'équipe s'il n'y est pas.
 *
 * Une adresse, pas un rôle en base : un seul lecteur, et aucune table à
 * protéger de plus. L'adresse doit être CONFIRMÉE — sans quoi n'importe
 * qui pourrait s'inscrire avec elle avant le propriétaire. Sans
 * `OWNER_EMAIL`, personne n'est propriétaire : une variable oubliée ferme
 * la porte au lieu de l'ouvrir.
 */
export function estProprietaire(user: Pick<User, "email" | "email_confirmed_at"> | null): boolean {
  const attendu = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!attendu || !user?.email || !user.email_confirmed_at) return false;
  return user.email.trim().toLowerCase() === attendu;
}
