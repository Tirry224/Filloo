import type { User } from "@supabase/supabase-js";

/**
 * Le compte du porteur du projet : celui qui voit `/suivi`, et SEULEMENT
 * `/suivi` (règle du 2026-10-07 — ce compte ne navigue plus dans l'app
 * comme un utilisateur). Lu par `/suivi` et par le middleware.
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

/**
 * TEMPORAIRE (2026-10-07) — ce que le serveur voit, pour comprendre
 * pourquoi un déploiement ne reconnaît pas le propriétaire. Ne révèle
 * JAMAIS la valeur d'OWNER_EMAIL : seulement si elle existe, sa longueur,
 * et si elle correspond à la connexion. À retirer une fois réglé.
 */
export function diagnosticProprietaire(user: Pick<User, "email" | "email_confirmed_at"> | null) {
  const brute = process.env.OWNER_EMAIL;
  const attendu = brute?.trim().toLowerCase();
  return {
    variablePresente: brute !== undefined,
    longueurVariable: brute?.length ?? 0,
    longueurNettoyee: attendu?.length ?? 0,
    guillemets: Boolean(brute && /["']/.test(brute)),
    emailConnecte: user?.email ?? null,
    emailConfirme: Boolean(user?.email_confirmed_at),
    correspond: estProprietaire(user),
  };
}
