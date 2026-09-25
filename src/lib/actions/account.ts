"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, getMyProfiles } from "@/lib/data/session";
import type { ActionState } from "@/lib/actions/auth";
import { erreurTelephone, nettoyerTelephone } from "@/lib/telephone";
import { passwordIsValid } from "@/lib/supabase/verify";
import { messagePourErreur } from "@/lib/erreurs";
import { erreurNom, lireIdEntier, texteNettoye } from "@/lib/saisie";
import { SHOP_PHOTOS_BUCKET } from "@/lib/storage";

/**
 * Le nom et le téléphone appartiennent à la CONNEXION : `profiles` porte
 * ces colonnes par rôle (`unique (auth_user_id, role)`), donc n'écrire que
 * sur le profil client corrigerait le numéro à moitié. La ville, elle, NE
 * se propage pas : `profiles.city_id` est la résidence d'un client (0010),
 * celle d'un commerçant est `merchants.city_id`.
 *
 * Colonnes modifiables : liste blanche de 0002 partie 4, complétée par 0010. */
export async function updateProfileAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const fullName = texteNettoye(formData.get("fullName"));
  const phone = String(formData.get("phone") ?? "").trim();
  /* Présente et vide, ou absente : les confondre efface une donnée. Le
     montage commerçant ne rend pas le menu des villes, donc `cityId`
     n'arrive pas dans son formulaire. `FormData.get` rend `null` pour un
     champ absent et `""` pour « Non renseignée ». */
  const cityBrut = formData.get("cityId");
  const villeFournie = cityBrut !== null;
  const cityIdRaw = String(cityBrut ?? "").trim();
  const cityId = cityIdRaw ? lireIdEntier(cityIdRaw) : null;
  if (!fullName || !phone) return { error: "Le nom et le téléphone sont obligatoires." };
  const erreurNomComplet = erreurNom(fullName, "Nom complet");
  if (erreurNomComplet) return { error: erreurNomComplet };
  const erreurNumero = erreurTelephone(phone, true);
  if (erreurNumero) return { error: erreurNumero };

  // Mot de passe exigé pour ÉCRIRE : ce numéro est celui par lequel un
  // commerçant rappelle, et le réécrire détournerait ces rappels.
  const currentPassword = String(formData.get("currentPassword") ?? "");
  if (!currentPassword) {
    return { error: "Confirmez avec votre mot de passe actuel pour enregistrer." };
  }
  if (cityIdRaw && !cityId) return { error: "Ville invalide." };

  const supabase = await createClient();
  const profiles = await getMyProfiles(supabase);
  const clientProfile = profiles.find((p) => p.role === "client");
  if (!profiles.some((p) => !p.isDeleted)) return { error: "Vous devez être connecté." };

  /* Vérifié AVANT la première écriture, pendant que rien n'a bougé.
     `passwordIsValid` utilise un client jetable sans cookie, sinon une
     faute de frappe déconnecterait au milieu du formulaire (voir
     `src/lib/supabase/verify.ts`). */
  const user = await getSessionUser(supabase);
  if (!user?.email) {
    return { error: "Impossible de vérifier votre mot de passe. Reconnectez-vous, puis réessayez." };
  }
  if (!(await passwordIsValid(user.email, currentPassword))) {
    return { error: "Mot de passe actuel incorrect. Aucune modification n'a été enregistrée." };
  }

  // TOUS les profils de la connexion : ce `.eq` dit ce qu'on veut écrire,
  // il ne fait pas office de serrure — le RLS s'en charge.
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: nettoyerTelephone(phone) })
    .eq("auth_user_id", user.id)
    .select("id");
  if (error) return { error: messagePourErreur(error, "compte") };
  // Le `using` de la policy filtre des LIGNES : s'il les écarte, la
  // réponse est un succès à zéro ligne. Sans ce contrôle, un profil
  // suspendu voit ses modifications acceptées à l'écran et perdues en base.
  if (!data || data.length === 0) {
    return { error: "Modification impossible. Reconnectez-vous, puis réessayez." };
  }

  /* Seconde écriture, et seulement si le formulaire a porté la ville ET
     qu'un profil client existe : la joindre à celle du dessus la
     recopierait sur le profil commerçant, contredisant sa boutique. */
  if (villeFournie && clientProfile) {
    const { error: villeError } = await supabase
      .from("profiles")
      .update({ city_id: cityId })
      .eq("id", clientProfile.id);
    if (villeError) {
      return { error: "Nom et téléphone enregistrés, mais pas la ville. Réessayez." };
    }
  }

  // L'espace vient du navigateur : il ne choisit qu'entre deux chemins
  // écrits ici. Même prudence que `safeNextPath`.
  redirect(formData.get("espace") === "merchant" ? "/vendeur/boutique" : "/compte");
}

/**
 * Supprimer mon compte — écran 18 : anonymisation, jamais un vrai DELETE
 * (docs/ECRANS.md, « Ce que cet inventaire a révélé »). Le client RLS ne peut pas le
 * faire — `is_deleted`/`deleted_at` sont hors de la liste blanche de 0002
 * partie 4 — et couper l'accès à `auth.users` exige `service_role` ; les
 * deux doivent arriver ENSEMBLE, d'où la connexion `admin`.
 *
 * `auth.users` n'est PAS supprimé : `messages.sender_id` référence
 * `profiles` SANS cascade, donc un `deleteUser` échouerait sur une clé
 * étrangère. Un BANNISSEMENT (`ban_duration`) coupe l'accès en laissant
 * l'historique lisible.
 */
export async function deleteAccountAction() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/connexion");

  /* Un échec REVIENT sur l'écran de confirmation au lieu de lever : levée,
     l'erreur tombait sur `error.tsx`, et la personne concluait à une panne
     de réseau pour un compte resté intact. Le détail part dans les
     journaux Vercel, préfixé pour s'y chercher. */
  try {
    await anonymiserEtBannir(user.id);
  } catch (erreur) {
    console.error("[suppression] compte non supprimé :", erreur instanceof Error ? erreur.message : erreur);
    redirect(
      `/compte/informations/supprimer?erreur=${encodeURIComponent(
        "La suppression n'a pas abouti. Réessayez plus tard ; si cela se répète, écrivez-nous.",
      )}`,
    );
  }

  await supabase.auth.signOut();
  redirect("/connexion");
}

async function anonymiserEtBannir(userId: string) {
  const admin = createAdminClient();

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", userId);
  if (profilesError) throw profilesError;
  for (const profile of profiles) {
    if (profile.role === "merchant") {
      const { data: merchant } = await admin
        .from("merchants")
        .select("id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (merchant) {
        const { error: hideError } = await admin
          .from("products")
          .update({ status: "hidden" })
          .eq("merchant_id", merchant.id);
        if (hideError) throw hideError;

        /* La photo de boutique peut être un visage : « supprimer mon
           compte » l'efface, fichier compris. Tout le dossier, pour
           emporter aussi les envois jamais enregistrés. */
        const { error: photoError } = await admin
          .from("merchants")
          .update({ photo_path: null })
          .eq("id", merchant.id);
        if (photoError) throw photoError;
        const { data: fichiers } = await admin.storage.from(SHOP_PHOTOS_BUCKET).list(merchant.id);
        if (fichiers && fichiers.length > 0) {
          const { error: storageError } = await admin.storage
            .from(SHOP_PHOTOS_BUCKET)
            .remove(fichiers.map((fichier) => `${merchant.id}/${fichier.name}`));
          if (storageError) console.error("[suppression] photo de boutique restée :", storageError.message);
        }
      }
    }

    // `throw` : en `service_role` le RLS n'écarte rien, une erreur est une
    // panne. Si l'anonymisation échoue et que le bannissement réussit, la
    // personne perd l'accès en laissant son nom en base.
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

  /* Explicitement : `0023` compte sur `on delete cascade` depuis
     `auth.users`, mais on BANNIT au lieu de supprimer, donc la cascade ne
     se déclenche jamais. Un abonnement push porte un identifiant
     d'appareil ; le garder contredit ce que ce bouton promet. */
  const { error: pushError } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("auth_user_id", userId);
  if (pushError) throw pushError;

  // ~100 ans : Supabase n'a pas de bannissement permanent dédié.
  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  if (banError) throw banError;
}
