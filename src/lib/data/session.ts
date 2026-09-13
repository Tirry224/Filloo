import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type SessionProfile = {
  id: string;
  role: "client" | "merchant";
  fullName: string;
  phone: string;
  cityId: number | null;
  isSuspended: boolean;
  isDeleted: boolean;
};

/**
 * `auth.getUser()`, pas `auth.getSession()` : la première revalide le jeton
 * auprès de Supabase, la seconde se contente de lire le cookie sans le
 * vérifier — suffisant pour de l'affichage, pas pour une décision de sécurité.
 * Voir https://supabase.com/docs/guides/auth/server-side/nextjs.
 *
 * Cette revalidation est un aller-retour réseau, pas une simple lecture de
 * cookie — et plusieurs écrans de l'espace vendeur appellent cette fonction
 * (via `getMyProfile`/`getMyMerchant`) deux ou trois fois chacun. Sans
 * `cache()`, chaque appel refaisait ce même aller-retour : `cache()` de
 * React mémorise le résultat pour la durée d'UNE requête, donc le premier
 * appel paie le coût réseau et tous les suivants sont gratuits. Le
 * middleware (`src/lib/supabase/middleware.ts`) garde son propre appel,
 * séparé : il tourne dans une exécution différente (Edge, avant que la
 * page ne s'affiche), que ce cache ne couvre pas.
 */
export const getSessionUser = cache(async (supabase: SupabaseClient<Database>): Promise<User | null> => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // `error` était ignoré, et c'était le défaut le plus coûteux du projet :
  // `getUser()` renvoie `user: null` AUSSI quand il n'a pas pu joindre le
  // serveur, pas seulement quand personne n'est connecté. Les deux cas
  // étaient donc traités comme « visiteur anonyme ».
  //
  // Vu à l'écran le 2026-09-13, base injoignable, session ouverte :
  // `/messages` affichait « Aucune conversation » — il annonçait à
  // quelqu'un qu'il n'a pas de messages alors qu'il n'avait pas pu
  // regarder. Sur un réseau guinéen instable, c'est aussi une
  // déconnexion apparente à chaque coupure passagère.
  //
  // « Pas de session » est une réponse ; tout le reste est une panne, et
  // une panne se propage pour que la frontière d'erreur affiche « Pas de
  // connexion » comme le fait déjà le fil d'accueil.
  if (error && !isAuthSessionMissingError(error)) throw error;
  return user;
});

/** Les 1 ou 2 profils (client, commerçant) de la connexion active. Mis en
 * cache pour la même raison que `getSessionUser` : `getMyProfile("client")`
 * et `getMyProfile("merchant")` appelés sur la même page ne doivent
 * interroger `profiles` qu'une seule fois. */
export const getMyProfiles = cache(async (supabase: SupabaseClient<Database>): Promise<SessionProfile[]> => {
  const user = await getSessionUser(supabase);
  if (!user) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, city_id, is_suspended, is_deleted")
    .eq("auth_user_id", user.id);
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    role: p.role,
    fullName: p.full_name,
    phone: p.phone,
    cityId: p.city_id,
    isSuspended: p.is_suspended,
    isDeleted: p.is_deleted,
  }));
});

/**
 * Où envoyer quelqu'un qui demande un écran de l'espace CLIENT sans avoir
 * de compte client.
 *
 * Deux situations que le code confondait, et qui n'ont rien à voir :
 *
 * - **personne n'est connecté** → `/connexion`, évidemment ;
 * - **une connexion existe, mais elle n'a qu'un compte commerçant** →
 *   `/vendeur/boutique`, son propre espace.
 *
 * Le second cas produisait un bug bien réel : un commerçant sans compte
 * client lié qui parcourt l'accueil (le catalogue est public, il y a donc
 * toute raison d'y être) et touche l'onglet « Compte » se retrouvait sur
 * l'écran de CONNEXION alors qu'il était déjà connecté. Et `signInAction`
 * renvoyant vers `/`, il pouvait tourner en rond.
 *
 * La décision d'aiguillage vit ici, pas dans `BottomNav`. Cette barre
 * porte désormais deux listes d'onglets (client et commerçant, décision de
 * `design/README.md`), mais les écrans PUBLICS du catalogue rendent
 * légitimement celle du client — ce sont des écrans de client — et
 * `loading.tsx`, synchrone, ne peut de toute façon pas résoudre une
 * session. Corriger la DESTINATION plutôt que chaque appelant règle en
 * plus le cas d'une URL mise en favori ou d'un lien partagé, qui ne
 * passent par aucune barre d'onglets.
 *
 * Gratuit : `getMyProfiles` est mis en cache pour la durée de la requête,
 * et l'appelant l'a déjà appelée juste avant via `getMyProfile`.
 */
export async function clientSpaceFallback(supabase: SupabaseClient<Database>): Promise<string> {
  const profiles = await getMyProfiles(supabase);
  return profiles.some((p) => p.role === "merchant") ? "/vendeur/boutique" : "/connexion";
}

/**
 * L'écran d'OUVERTURE de la connexion active : `/vendeur` pour une
 * connexion qui n'a qu'un compte commerçant, `/` sinon.
 *
 * Ce n'est pas un détail de confort, c'est une décision écrite du projet
 * (`design/README.md`, et `docs/SPEC.md` décision 8) :
 *
 * > Le commerçant et le client n'ont pas la même barre d'onglets, ni le
 * > même écran d'ouverture, ni le même écran « Mon compte ». C'est ce qui
 * > rendait la maquette confuse : les deux rôles y voyaient exactement la
 * > même application.
 *
 * L'application la violait : `signInAction` renvoyait TOUJOURS vers `/`,
 * donc un commerçant se connectait et atterrissait sur le fil client, avec
 * la barre d'onglets du client (Accueil · Rechercher · Messages · Compte)
 * — alors que sa barre à lui en compte trois (Ma boutique · Messages ·
 * Compte). Il voyait « Aucun produit à Conakry » au lieu de sa boutique,
 * et concluait, à juste titre, que les deux espaces étaient mélangés.
 *
 * Pourquoi « n'a QUE » un compte commerçant : une personne qui possède les
 * deux comptes liés a un espace client légitime, et `/` est son écran
 * d'ouverture normal — elle bascule vers sa boutique quand elle le décide
 * (`SwitchSpaceCard`). Seule une connexion sans compte client n'a rien à
 * faire sur le fil client.
 *
 * Gratuit : `getMyProfiles` est mis en cache pour la durée de la requête.
 */
export async function landingForSession(supabase: SupabaseClient<Database>): Promise<string> {
  const profiles = await getMyProfiles(supabase);
  const onlyMerchant =
    profiles.some((p) => p.role === "merchant") && !profiles.some((p) => p.role === "client");
  return onlyMerchant ? "/vendeur" : "/";
}

/** Le profil (client OU commerçant) de la connexion active pour ce rôle,
 * ou `null` si elle n'a pas encore ce compte-là. */
export async function getMyProfile(
  supabase: SupabaseClient<Database>,
  role: "client" | "merchant",
): Promise<SessionProfile | null> {
  const profiles = await getMyProfiles(supabase);
  return profiles.find((p) => p.role === role) ?? null;
}
