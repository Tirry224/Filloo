"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, getMyProfiles } from "@/lib/data/session";
import type { ActionState } from "@/lib/actions/auth";
import { erreurTelephone, nettoyerTelephone } from "@/lib/telephone";
import { passwordIsValid } from "@/lib/supabase/verify";

/**
 * Mes informations — écran 18, monté par les deux espaces.
 *
 * LE NOM ET LE TÉLÉPHONE APPARTIENNENT À LA CONNEXION, PAS AU RÔLE :
 * `profiles` porte ces colonnes par rôle (`unique (auth_user_id, role)`), donc
 * n'écrire que sur le profil client corrigeait le numéro à moitié. L'identité
 * PUBLIQUE de la boutique (`shop_name`, `whatsapp_phone`) se modifie ailleurs.
 *
 * LA VILLE NE SE PROPAGE PAS : `profiles.city_id` est la résidence d'un
 * client (0010), celle d'un commerçant est sa boutique (`merchants.city_id`).
 *
 * Colonnes modifiables : liste blanche de 0002 partie 4, complétée par 0010. */
export async function updateProfileAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  /* PRÉSENTE ET VIDE, OU ABSENTE : les confondre effaçait une donnée. Le
     montage commerçant ne rend pas le menu des villes, donc `cityId`
     n'arrive pas dans son formulaire ; traité comme « vide », il remettait
     à NULL la ville de résidence du compte client. `FormData.get` rend
     `null` pour un champ absent et `""` pour « Non renseignée ». */
  const cityBrut = formData.get("cityId");
  const villeFournie = cityBrut !== null;
  const cityIdRaw = String(cityBrut ?? "").trim();
  const cityId = cityIdRaw ? Number(cityIdRaw) : null;
  if (!fullName || !phone) return { error: "Le nom et le téléphone sont obligatoires." };
  const erreurNumero = erreurTelephone(phone, true);
  if (erreurNumero) return { error: erreurNumero };

  /* Le mot de passe actuel est exigé pour ÉCRIRE, exactement comme pour
     une boutique : ce nom et ce téléphone sont ce par quoi un commerçant
     rappelle un client après une commande, et les réécrire depuis un
     téléphone emprunté détournerait ces rappels. */
  const currentPassword = String(formData.get("currentPassword") ?? "");
  if (!currentPassword) {
    return { error: "Confirmez avec votre mot de passe actuel pour enregistrer." };
  }
  if (cityIdRaw && (!cityId || Number.isNaN(cityId))) return { error: "Ville invalide." };

  const supabase = await createClient();
  const profiles = await getMyProfiles(supabase);
  /* Neutre au rôle : un commerçant sans compte client lié doit pouvoir
     corriger son nom, ce qu'exiger un profil client lui interdisait. */
  const clientProfile = profiles.find((p) => p.role === "client");
  if (!profiles.some((p) => !p.isDeleted)) return { error: "Vous devez être connecté." };

  /* Vérifié AVANT la première écriture : ce qui peut être refusé doit
     l'être pendant que rien n'a encore bougé. `passwordIsValid` utilise un
     client Supabase jetable, qui n'écrit aucun cookie — une faute de
     frappe ne peut donc pas déconnecter quelqu'un au milieu de son
     formulaire (voir `src/lib/supabase/verify.ts`). */
  const user = await getSessionUser(supabase);
  if (!user?.email) {
    return { error: "Impossible de vérifier votre mot de passe. Reconnectez-vous, puis réessayez." };
  }
  if (!(await passwordIsValid(user.email, currentPassword))) {
    return { error: "Mot de passe actuel incorrect. Aucune modification n'a été enregistrée." };
  }

  /* TOUS les profils de la connexion, désignés par `auth_user_id` : c'est
     ce filtre qui empêche la correction de s'arrêter à un seul rôle. Le RLS
     borne de toute façon l'écriture aux lignes de la personne connectée, ce
     `.eq` dit ce qu'on veut écrire et ne fait pas office de serrure. */
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: nettoyerTelephone(phone) })
    .eq("auth_user_id", user.id)
    .select("id");
  if (error) return { error: error.message };
  // Le `using` de la policy filtre des LIGNES : s'il écarte celles-ci, la
  // réponse est un succès portant zéro ligne, pas une erreur. Sans cette
  // vérification, un profil suspendu voyait ses modifications acceptées à
  // l'écran et perdues en base.
  if (!data || data.length === 0) {
    return { error: "Modification impossible. Reconnectez-vous, puis réessayez." };
  }

  /* SECONDE écriture, et seulement si le formulaire a porté la ville ET
     qu'un profil client existe pour la recevoir : la joindre à celle du
     dessus la recopierait sur le profil commerçant, où elle finirait par
     contredire la ville de la boutique. */
  if (villeFournie && clientProfile) {
    const { error: villeError } = await supabase
      .from("profiles")
      .update({ city_id: cityId })
      .eq("id", clientProfile.id);
    /* Seul cas où cette action réussit à moitié : on le DIT plutôt que de
       rendre un succès, sinon la personne relit son écran sans y trouver la
       ville qu'elle vient de choisir, ni savoir pourquoi. */
    if (villeError) {
      return { error: "Nom et téléphone enregistrés, mais pas la ville. Réessayez." };
    }
  }

  /* L'espace vient du navigateur : on ne lui laisse choisir QU'ENTRE deux
     chemins internes écrits ici, tout ce qui n'est pas exactement
     « merchant » ramène côté client. Même prudence que `safeNextPath`. */
  redirect(formData.get("espace") === "merchant" ? "/vendeur/boutique" : "/compte");
}

/**
 * Supprimer mon compte — écran 18, section 4 point 3 de docs/REPRISE.md :
 * anonymisation, jamais un vrai DELETE. Impossible avec le client RLS de
 * l'utilisateur : `is_deleted`/`deleted_at` sont hors de la liste blanche des
 * colonnes modifiables (0002 partie 4) pour qu'un profil ne puisse pas se
 * marquer supprimé pendant que sa connexion reste active, couper l'accès à
 * `auth.users` exige `service_role`, et les deux doivent arriver ENSEMBLE —
 * d'où l'unique connexion `admin` ci-dessous.
 *
 * **Piège évité** : `auth.users` n'est PAS supprimé. `profiles.auth_user_id`
 * référence `auth.users(id) on delete cascade` (0001) et les `profiles` sont
 * référencés par `messages.sender_id` SANS cascade : un `deleteUser` aurait
 * échoué sur une contrainte de clé étrangère, au clic même sur « Supprimer ».
 * La bonne opération est un BANNISSEMENT (`ban_duration`) : la connexion
 * devient inutilisable, `auth.users` et `profiles` survivent — exactement
 * « couper l'accès sans effacer l'historique ».
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
      // suffit (policy "products: catalogue public" exige déjà `active`).
      if (merchant) {
        const { error: hideError } = await admin
          .from("products")
          .update({ status: "hidden" })
          .eq("merchant_id", merchant.id);
        if (hideError) throw hideError;
      }
    }

    // `throw` et non un message rendu à l'écran : ces écritures tournent
    // avec `service_role`, le RLS ne peut pas les écarter — une erreur ici
    // est une panne, pas un refus. Et elle doit être vue : si
    // l'anonymisation échoue alors que le bannissement qui suit réussit, la
    // personne perd l'accès pendant que son nom et son téléphone restent en
    // base — l'inverse exact de ce que « Supprimer mon compte » promet.
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

  /* LES APPAREILS PARTENT AVEC LE COMPTE, explicitement : `0023` compte sur
     `on delete cascade` depuis `auth.users`, mais on BANNIT au lieu de
     supprimer — pour garder les fils lisibles par l'autre partie — donc la
     cascade ne se déclenche jamais. Un abonnement push porte un identifiant
     d'appareil et l'empreinte de son navigateur : les garder après
     « supprimer mon compte » contredit ce que ce bouton promet. Aucun push
     ne partait pour autant (`notifyNewMessage` s'arrête sur `is_deleted`),
     mais protéger une donnée par la retenue de l'appelant ne suffit pas. */
  const { error: pushError } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("auth_user_id", user.id);
  if (pushError) throw pushError;

  // ~100 ans : Supabase n'a pas de "bannissement permanent" dédié, une
  // durée trop longue pour expirer en pratique en tient lieu.
  const { error: banError } = await admin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
  if (banError) throw banError;

  await supabase.auth.signOut();
  redirect("/connexion");
}
