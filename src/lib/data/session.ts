import { redirect } from "next/navigation";
import { refusEspaceClient, refusEspaceCommercant } from "@/lib/data/espace-decision";
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
 * auprès de Supabase, la seconde lit le cookie sans le vérifier —
 * suffisant pour de l'affichage, pas pour une décision de sécurité.
 *
 * Cette revalidation est un aller-retour réseau, et plusieurs écrans
 * appellent cette fonction deux ou trois fois : `cache()` de React mémorise
 * le résultat pour la durée d'UNE requête, donc seul le premier appel paie.
 * Le middleware garde le sien, dans une exécution Edge séparée que ce cache
 * ne couvre pas.
 */
export const getSessionUser = cache(async (supabase: SupabaseClient<Database>): Promise<User | null> => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // `error` ÉTAIT IGNORÉ, et c'était le défaut le plus coûteux du projet :
  // `getUser()` renvoie `user: null` AUSSI quand il n'a pas pu joindre le
  // serveur, pas seulement quand personne n'est connecté. Les deux cas
  // étaient traités comme « visiteur anonyme », donc `/messages` annonçait
  // « Aucune conversation » à quelqu'un qui n'avait pas pu regarder — et,
  // sur un réseau instable, une déconnexion apparente à chaque coupure.
  //
  // « Pas de session » est une réponse ; tout le reste est une panne, et une
  // panne se propage pour que la frontière d'erreur dise « Pas de
  // connexion ».
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
 * de compte client. Deux situations que le code confondait :
 *
 * - personne n'est connecté → `/connexion` ;
 * - une connexion existe mais n'a qu'un compte commerçant → son propre
 *   espace, `/vendeur/boutique`.
 *
 * Le second cas était un vrai bug : un commerçant sans compte client qui
 * parcourt le catalogue — public, il a toute raison d'y être — et touche
 * « Compte » atterrissait sur l'écran de CONNEXION alors qu'il était déjà
 * connecté, et pouvait tourner en rond.
 *
 * La décision vit ici et non dans la barre d'onglets : corriger la
 * DESTINATION règle aussi le cas d'une URL mise en favori ou d'un lien
 * partagé, qui ne passent par aucune barre.
 */
export async function clientSpaceFallback(supabase: SupabaseClient<Database>): Promise<string> {
  const profiles = await getMyProfiles(supabase);
  return profiles.some((p) => p.role === "merchant") ? "/vendeur/boutique" : "/connexion";
}

/**
 * L'écran d'OUVERTURE de la connexion active : `/vendeur` pour une
 * connexion qui n'a QUE un compte commerçant, `/` sinon.
 *
 * Ce n'est pas du confort mais la décision 8 de SPEC : les deux rôles n'ont
 * ni la même barre d'onglets, ni le même écran d'ouverture. `signInAction`
 * renvoyait TOUJOURS vers `/`, donc un commerçant se connectait et voyait
 * « Aucun produit à Conakry » au lieu de sa boutique.
 *
 * « N'a QUE » : une personne qui possède les deux comptes a un espace
 * client légitime et bascule quand elle le décide (`SwitchSpaceCard`).
 */
export async function landingForSession(supabase: SupabaseClient<Database>): Promise<string> {
  const profiles = await getMyProfiles(supabase);
  const merchant = profiles.find((p) => p.role === "merchant");
  const onlyMerchant = Boolean(merchant) && !profiles.some((p) => p.role === "client");

  /* Une BOUCLE, et la boucle exacte que `/compte/suspendu` cherchait déjà
     à éviter de son côté :

       /compte/suspendu → « Voir les produits » → / → /vendeur →
       /compte/suspendu → …

     Un commerçant suspendu SANS compte client était renvoyé chez lui par
     cette fonction, et `/vendeur` le renvoyait aussitôt sur l'écran de
     suspension, qui lui promet précisément de pouvoir encore consulter le
     catalogue. Le seul bouton de cet écran ne menait donc nulle part.

     La suspension coupe l'écriture, pas la lecture (voir
     `/compte/suspendu`) : le catalogue public est l'endroit où cette
     personne a le droit d'être, et c'est donc là qu'elle atterrit tant
     que sa boutique lui est fermée. Elle y voit la barre d'onglets du
     client, comme tout visiteur du catalogue — et son espace commerçant
     ne lui est pas présenté comme utilisable alors qu'il ne l'est pas. */
  if (onlyMerchant && merchant?.isSuspended) return "/";

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

/**
 * La garde de l'espace COMMERÇANT, appelée par `(vendeur)/layout.tsx` et
 * par lui seul : c'est tout l'intérêt.
 *
 * Avant, chaque écran de `/vendeur` refaisait ce contrôle. Sept écrans,
 * sept copies d'une décision de sécurité — et la huitième manquait :
 * `/vendeur/produits/[id]/actions` n'en avait AUCUNE. Le RLS protège les
 * DONNÉES, mais ne dit rien de la navigation : un client authentifié qui
 * tapait cette URL obtenait la feuille d'actions, vide mais habillée en
 * commerçant. Une garde qu'on recopie est une garde qu'on oubliera ; dans
 * un layout, une route enfant ne peut pas la contourner.
 *
 * CE QU'ELLE NE FAIT PAS, VOLONTAIREMENT : regarder `merchants.status`.
 * `/vendeur/attente` et `/vendeur/refusee` sont DANS cet espace et doivent
 * rester joignables. Elle ne vérifie pas non plus l'existence de la
 * boutique : un profil commerçant sans boutique est un état normal, et
 * `/vendeur/page.tsx` envoie alors sur `/inscription/boutique`.
 */
export async function requireMerchantSpace(
  supabase: SupabaseClient<Database>,
): Promise<SessionProfile> {
  const profiles = await getMyProfiles(supabase);

  // La décision vit dans `espace-decision.ts`, où elle se teste sans base
  // ni contexte Next — voir `scripts/verifier-gardes.mjs`. Ici ne reste
  // que le trajet : lire les profils, appliquer, rediriger.
  const refus = refusEspaceCommercant(profiles);
  if (refus) redirect(refus);

  return profiles.find((p) => p.role === "merchant")!;
}

/**
 * La garde symétrique, pour l'espace CLIENT authentifié (`/compte`,
 * `/messages`). Le catalogue public — `/`, `/recherche`, `/produit`,
 * `/boutique` — n'est PAS derrière elle : il est lisible sans compte, et
 * c'est une décision du projet, pas un oubli.
 *
 * Elle reprend `clientSpaceFallback`, qui savait déjà distinguer « nul
 * n'est connecté » de « connecté, mais sans compte client » ; elle lui
 * ajoute seulement le contrôle de suspension, que les deux écrans
 * appelants faisaient chacun de leur côté.
 */
export async function requireClientSpace(
  supabase: SupabaseClient<Database>,
): Promise<SessionProfile> {
  const profiles = await getMyProfiles(supabase);

  const refus = refusEspaceClient(profiles);
  if (refus) redirect(refus);

  return profiles.find((p) => p.role === "client")!;
}
