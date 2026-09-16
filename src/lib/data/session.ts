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
 * La garde de l'espace COMMERÇANT. Appelée par `(vendeur)/layout.tsx`, et
 * par lui seul : c'est tout l'intérêt.
 *
 * CE QU'ELLE REMPLACE
 * Avant, chaque écran de `/vendeur` refaisait ce contrôle à la main. Sept
 * écrans, sept copies d'une même décision de sécurité — et la huitième
 * manquait : `/vendeur/produits/[id]/actions` n'en avait AUCUNE. Elle ne
 * tenait que par le RLS, qui protège bien les DONNÉES mais ne dit rien de
 * la navigation : un client authentifié qui tapait cette URL obtenait la
 * feuille d'actions d'un produit, vide de son contenu mais habillée en
 * commerçant. Une garde qu'on recopie est une garde qu'on oubliera.
 *
 * Elle vit dans un layout parce qu'un layout est le seul endroit qu'une
 * route enfant ne peut pas contourner : ajouter demain un écran sous
 * `/vendeur/` le met derrière cette garde sans que personne n'y pense.
 *
 * CE QU'ELLE NE FAIT PAS, VOLONTAIREMENT
 * Elle ne regarde pas `merchants.status`. `/vendeur/attente` et
 * `/vendeur/refusee` sont DANS cet espace et doivent rester joignables —
 * ce sont les écrans qui expliquent à une boutique non validée où elle en
 * est. L'aiguillage par statut reste dans `/vendeur/page.tsx`, qui est le
 * seul à avoir besoin de le faire.
 *
 * Elle ne vérifie pas non plus l'existence de la BOUTIQUE : avoir un
 * profil commerçant sans boutique est un état normal (entre l'inscription
 * et le formulaire de création), et c'est `/vendeur/page.tsx` qui envoie
 * alors sur `/inscription/boutique`.
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
