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
 * `full_name`, `phone` et `city_id` sont modifiables par un utilisateur
 * (liste blanche de colonnes, 0002_rules_and_security.sql partie 4,
 * complétée par 0010_client_profile_city.sql) : seul l'email de la
 * maquette n'a pas de colonne réelle — voir docs/REPRISE.md.
 *
 * LE NOM ET LE TÉLÉPHONE APPARTIENNENT À LA CONNEXION, PAS AU RÔLE
 * C'est la décision du porteur du projet, et c'est la troisième fois que
 * ce projet la prend : le mot de passe (`ChangePasswordForm`) et
 * l'abonnement push (`0023`) ont déjà été rangés du côté de la connexion,
 * avec les mêmes mots. Une personne a un nom et un numéro ; ce qui change
 * selon le rôle, c'est l'identité PUBLIQUE de la boutique —
 * `merchants.shop_name` et `merchants.whatsapp_phone` — qui existe pour
 * ça et se modifie ailleurs.
 *
 * CE QUE ÇA CORRIGE, ET QUI A ÉTÉ CONSTATÉ À L'USAGE
 * `profiles` porte ces colonnes PAR RÔLE (`unique (auth_user_id, role)`),
 * donc une connexion à deux comptes en détient deux copies. Cette action
 * n'écrivait que sur le profil client : quelqu'un qui corrigeait son
 * numéro le corrigeait à moitié, et l'autre moitié gardait indéfiniment
 * ce qui avait été tapé à l'inscription — y compris le numéro par lequel
 * on rappelle un commerçant pour valider sa boutique.
 *
 * AUCUNE MIGRATION N'A ÉTÉ NÉCESSAIRE : la policy « profiles: je modifie
 * mon profil » (0002, resserrée par 0006) est portée par
 * `auth_user_id = auth.uid()`, pas par un identifiant de profil. Elle
 * autorisait donc déjà cette écriture — c'est le code applicatif qui se
 * limitait tout seul.
 *
 * LA VILLE, ELLE, NE SE PROPAGE PAS. `profiles.city_id` est la ville de
 * RÉSIDENCE d'un client (0010) ; celle d'un commerçant est la ville de sa
 * boutique et vit dans `merchants.city_id`. Les recopier l'une sur
 * l'autre confondrait « où j'habite » et « où l'on me trouve ». */
export async function updateProfileAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  /* PRÉSENTE ET VIDE, OU ABSENTE : ce ne sont PAS la même chose, et les
     confondre effaçait une donnée.
     Le montage commerçant ne rend pas le menu des villes — la ville d'un
     commerçant est celle de sa boutique — donc `cityId` n'arrive pas du
     tout dans son formulaire. Traité comme « vide », il remettait la
     ville de résidence du compte client à NULL : corriger son nom depuis
     l'espace commerçant effaçait en silence une information saisie
     ailleurs.
     `FormData.get` rend `null` pour un champ ABSENT et `""` pour un champ
     présent laissé sur « Non renseignée ». On lit donc les deux. */
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
  /* Neutre au rôle, comme l'écran de suppression depuis le 2026-09-13 :
     un commerçant sans compte client lié doit pouvoir corriger son nom,
     et il ne le pouvait pas tant que cette ligne exigeait un profil
     client. */
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

  /* TOUS les profils de la connexion, désignés par `auth_user_id` et non
     par un identifiant de profil : c'est ce filtre-là qui fait que la
     correction ne s'arrête plus à un seul rôle. Le RLS borne de toute
     façon l'écriture aux lignes de la personne connectée, donc ce `.eq`
     dit ce qu'on veut écrire, il ne fait pas office de serrure. */
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

  /* La ville part dans une SECONDE écriture, et seulement si le
     formulaire l'a réellement portée ET qu'un profil client existe pour
     la recevoir. La joindre à celle du dessus l'aurait recopiée sur le
     profil commerçant, où elle ne veut rien dire — et où elle aurait fini
     par contredire la ville de la boutique. */
  if (villeFournie && clientProfile) {
    const { error: villeError } = await supabase
      .from("profiles")
      .update({ city_id: cityId })
      .eq("id", clientProfile.id);
    /* Une ville qui ne s'enregistre pas alors que le nom l'a fait est le
       seul cas où cette action réussit à moitié. On le DIT plutôt que de
       rendre un succès : la personne relirait son écran et n'y verrait
       pas la ville qu'elle vient de choisir, sans savoir pourquoi. */
    if (villeError) {
      return { error: "Nom et téléphone enregistrés, mais pas la ville. Réessayez." };
    }
  }

  /* L'espace vient du formulaire, donc du navigateur : on ne lui laisse
     choisir QU'ENTRE deux chemins internes écrits ici. Tout ce qui n'est
     pas exactement « merchant » ramène côté client — c'est la même
     prudence que `safeNextPath`, en plus simple puisqu'il n'y a que deux
     réponses possibles et qu'aucune ne vient de l'URL. */
  redirect(formData.get("espace") === "merchant" ? "/vendeur/boutique" : "/compte");
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

  /* LES APPAREILS PARTENT AVEC LE COMPTE, ET IL FAUT L'ÉCRIRE ICI.
     La migration `0023` compte sur `on delete cascade` depuis
     `auth.users` — ce qui serait vrai si on SUPPRIMAIT la connexion. On
     la BANNIT (voir juste en dessous), précisément pour garder les fils
     de discussion lisibles par l'autre partie : la ligne `auth.users`
     survit, donc la cascade ne se déclenche jamais et les abonnements
     restaient en base indéfiniment.

     Ce ne sont pas des lignes inertes : un abonnement push porte un
     identifiant d'appareil et l'empreinte de son navigateur. Les garder
     après « supprimer mon compte » contredit ce que ce bouton promet.

     Aucun push ne partait pour autant — `notifyNewMessage` s'arrête sur
     `is_deleted` — mais compter sur la retenue de l'appelant pour
     protéger une donnée, c'est exactement ce que le reste du projet
     refuse de faire. */
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
