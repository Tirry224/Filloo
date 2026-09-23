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
 * `auth.getUser()` et non `auth.getSession()` : seul le premier revalide le
 * jeton auprès de Supabase, et c'est une décision de sécurité.
 */
export const getSessionUser = cache(async (supabase: SupabaseClient<Database>): Promise<User | null> => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // `getUser()` renvoie `user: null` aussi bien quand personne n'est
  // connecté que quand le serveur est injoignable. « Pas de session » est
  // une réponse ; tout le reste est une panne et doit se propager, sinon
  // une coupure réseau se lit comme une déconnexion.
  if (error && !isAuthSessionMissingError(error)) throw error;
  return user;
});

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
 * Où envoyer quelqu'un qui demande l'espace CLIENT sans compte client :
 * `/connexion` si personne n'est connecté, `/vendeur/boutique` si la
 * connexion n'a qu'un compte commerçant — la renvoyer vers `/connexion`
 * la ferait tourner en rond. Ici et non dans la barre d'onglets, pour
 * couvrir aussi les favoris et les liens partagés.
 */
export async function clientSpaceFallback(supabase: SupabaseClient<Database>): Promise<string> {
  const profiles = await getMyProfiles(supabase);
  return profiles.some((p) => p.role === "merchant") ? "/vendeur/boutique" : "/connexion";
}

export async function landingForSession(supabase: SupabaseClient<Database>): Promise<string> {
  const profiles = await getMyProfiles(supabase);
  const merchant = profiles.find((p) => p.role === "merchant");
  const onlyMerchant = Boolean(merchant) && !profiles.some((p) => p.role === "client");

  /* Sans ce cas, boucle : /compte/suspendu → « Voir les produits » → / →
     /vendeur → /compte/suspendu. La suspension coupe l'écriture, pas la
     lecture : le catalogue public est là où cette personne a le droit
     d'être tant que sa boutique lui est fermée. */
  if (onlyMerchant && merchant?.isSuspended) return "/";

  return onlyMerchant ? "/vendeur" : "/";
}

export async function getMyProfile(
  supabase: SupabaseClient<Database>,
  role: "client" | "merchant",
): Promise<SessionProfile | null> {
  const profiles = await getMyProfiles(supabase);
  return profiles.find((p) => p.role === role) ?? null;
}

/**
 * La garde de l'espace COMMERÇANT, appelée par `(vendeur)/layout.tsx` et
 * par lui seul : une route enfant ne peut pas contourner un layout, alors
 * qu'une garde recopiée par écran finit par manquer quelque part. Le RLS
 * protège les données, pas la navigation.
 *
 * Volontairement, elle ne regarde ni `merchants.status` — `/vendeur/attente`
 * et `/vendeur/refusee` vivent dans cet espace — ni l'existence de la
 * boutique, état normal que `/vendeur/page.tsx` traite.
 */
export async function requireMerchantSpace(
  supabase: SupabaseClient<Database>,
): Promise<SessionProfile> {
  const profiles = await getMyProfiles(supabase);

  const refus = refusEspaceCommercant(profiles);
  if (refus) redirect(refus);

  return profiles.find((p) => p.role === "merchant")!;
}

/**
 * La garde symétrique, pour l'espace CLIENT authentifié (`/compte`,
 * `/messages`). Le catalogue public — `/`, `/recherche`, `/produit`,
 * `/boutique` — n'est pas derrière elle : il se lit sans compte, et c'est
 * une décision du projet.
 */
export async function requireClientSpace(
  supabase: SupabaseClient<Database>,
): Promise<SessionProfile> {
  const profiles = await getMyProfiles(supabase);

  const refus = refusEspaceClient(profiles);
  if (refus) redirect(refus);

  return profiles.find((p) => p.role === "client")!;
}
