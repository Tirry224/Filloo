"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, getMyProfile } from "@/lib/data/session";
import type { ActionState } from "@/lib/actions/auth";

/** Mes informations — écran 18. `full_name`, `phone` et `city_id` sont
 * modifiables par un utilisateur (liste blanche de colonnes,
 * 0002_rules_and_security.sql partie 4, complétée par
 * 0010_client_profile_city.sql) : seul l'email de la maquette n'a pas de
 * colonne réelle — voir docs/REPRISE.md. `city_id` reste facultatif :
 * contrairement au nom et au téléphone, ce n'est pas une information
 * obligatoire pour utiliser l'app. */
export async function updateProfileAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const cityIdRaw = String(formData.get("cityId") ?? "").trim();
  const cityId = cityIdRaw ? Number(cityIdRaw) : null;
  if (!fullName || !phone) return { error: "Le nom et le téléphone sont obligatoires." };
  if (cityIdRaw && (!cityId || Number.isNaN(cityId))) return { error: "Ville invalide." };

  const supabase = await createClient();
  const profile = await getMyProfile(supabase, "client");
  if (!profile) return { error: "Vous devez être connecté." };

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone, city_id: cityId })
    .eq("id", profile.id)
    .select("id");
  if (error) return { error: error.message };
  // Le `using` de la policy filtre des LIGNES : s'il écarte celle-ci, la
  // réponse est un succès portant zéro ligne, pas une erreur. Sans cette
  // vérification, un profil suspendu voyait ses modifications acceptées à
  // l'écran et perdues en base.
  if (!data || data.length === 0) {
    return { error: "Modification impossible. Reconnectez-vous, puis réessayez." };
  }

  redirect("/compte");
}

/**
 * Supprimer mon compte — écran 18, décision de section 4 point 3 de
 * docs/REPRISE.md : anonymisation, jamais un vrai DELETE. Trois raisons
 * pour lesquelles cette fonction ne peut PAS tourner avec le client normal
 * de l'utilisateur (RLS) :
 *
 * 1. `profiles.is_deleted`/`deleted_at` sont hors de la liste blanche de
 *    colonnes modifiables par un utilisateur (0002_rules_and_security.sql,
 *    partie 4) — volontairement, pour ne jamais laisser un profil se
 *    marquer supprimé pendant que sa connexion reste active.
 * 2. Couper l'accès à `auth.users` demande l'API Admin, qui exige
 *    `service_role`.
 * 3. Les deux doivent arriver ENSEMBLE : d'où la connexion `admin` unique
 *    ci-dessous, jamais deux opérations séparées qui pourraient réussir
 *    l'une sans l'autre.
 *
 * **Piège évité en écrivant cette fonction** : `auth.users` n'est PAS
 * supprimé (`admin.auth.admin.deleteUser`). `profiles.auth_user_id`
 * référence `auth.users(id) on delete cascade` (0001_schema.sql) —
 * supprimer la ligne `auth.users` aurait donc tenté de supprimer aussi les
 * lignes `profiles`, qui sont elles-mêmes référencées par
 * `messages.sender_id` SANS cascade. Résultat : une erreur de contrainte
 * de clé étrangère aurait fait échouer l'opération entière, au moment
 * précis où l'utilisateur clique sur « Supprimer ». La bonne opération est
 * un BANNISSEMENT (`ban_duration`) : la connexion devient définitivement
 * inutilisable, la ligne `auth.users` survit, `profiles` aussi — exactement
 * ce que « couper l'accès sans effacer l'historique » demande.
 */
export async function deleteAccountAction() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/connexion");

  const admin = createAdminClient();

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id);
  if (profilesError) throw profilesError;

  for (const profile of profiles) {
    if (profile.role === "merchant") {
      const { data: merchant } = await admin
        .from("merchants")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      // Retire du catalogue public plutôt que de toucher `merchants.status` :
      // aucune valeur de l'énumération ('pending'/'approved'/'rejected') ne
      // veut dire « fermée par son propriétaire », et masquer les produits
      // suffit à obtenir le même résultat visible (policy "products:
      // catalogue public" exige déjà un produit `active`).
      if (merchant) {
        const { error: hideError } = await admin
          .from("products")
          .update({ status: "hidden" })
          .eq("merchant_id", merchant.id);
        if (hideError) throw hideError;
      }
    }

    // `throw` et non un message d'erreur rendu à l'écran : ces deux
    // écritures tournent avec `service_role`, donc le RLS ne peut pas les
    // écarter — une erreur ici est une vraie panne, pas un refus.
    //
    // Elles n'inspectaient rien du tout, et c'était le pire endroit du
    // projet pour le faire : si l'anonymisation échoue alors que le
    // bannissement qui suit réussit, la personne perd l'accès à son compte
    // pendant que son nom et son téléphone restent en base. « Supprimer
    // mon compte » aurait alors fait exactement l'inverse de ce qu'il
    // promet, sans que personne puisse s'en apercevoir.
    const { error: anonError } = await admin
      .from("profiles")
      .update({
        full_name: "Compte supprimé",
        phone: "000000000",
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    if (anonError) throw anonError;
  }

  // ~100 ans : Supabase n'a pas de "bannissement permanent" dédié, une
  // durée trop longue pour expirer en pratique en tient lieu.
  const { error: banError } = await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
  if (banError) throw banError;

  await supabase.auth.signOut();
  redirect("/connexion");
}
