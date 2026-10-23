import { createAdminClient } from "@/lib/supabase/admin";
import { SHOP_PHOTOS_BUCKET } from "@/lib/storage";

type Admin = ReturnType<typeof createAdminClient>;
type Role = "client" | "merchant";

/**
 * Le cœur de « supprimer mon compte », partagé par le site
 * (`deleteAccountAction`) et l'app mobile (`/api/app/supprimer-compte`).
 *
 * Hors de `src/lib/actions/` EXPRÈS : toute fonction exportée d'un fichier
 * `"use server"` devient une action appelable depuis n'importe quel
 * navigateur. Celles-ci prennent un `userId` sans vérifier qui le
 * demande : exposées, elles effaceraient le compte de n'importe qui. Leurs
 * appelants vérifient la session ET le mot de passe avant de les appeler.
 */

/**
 * Supprime UN des comptes liés — le client ou la boutique — et laisse
 * l'autre intact (décision du porteur du projet, 2026-10-23). La
 * connexion n'est fermée, et l'email libéré, que s'il ne reste plus aucun
 * compte actif : l'autre en a encore besoin pour se connecter et
 * recevoir ses notifications.
 *
 * Rejouable : relancée après une panne, elle refait l'effacement du
 * profil et ferme la connexion s'il n'en reste plus.
 */
export async function supprimerProfil(userId: string, role: Role): Promise<{ connexionFermee: boolean }> {
  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, role, is_deleted")
    .eq("auth_user_id", userId);
  if (error) throw error;

  const cible = profiles.find((p) => p.role === role);
  if (cible) await effacerProfil(admin, cible);

  if (profiles.some((p) => p.role !== role && !p.is_deleted)) return { connexionFermee: false };
  await couperConnexion(admin, userId);
  return { connexionFermee: true };
}

/**
 * Supprime TOUS les comptes de la connexion et la ferme : ce que fait
 * l'app mobile installée, qui n'envoie pas de rôle. Gardée telle quelle
 * pour ne pas changer ce que ces téléphones déclenchent.
 */
export async function anonymiserEtBannir(userId: string) {
  const admin = createAdminClient();
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", userId);
  if (profilesError) throw profilesError;
  for (const profile of profiles) await effacerProfil(admin, profile);
  await couperConnexion(admin, userId);
}

/** Efface un profil : son identité, et pour une boutique ses produits,
 *  photos et coordonnées. Ne touche ni à l'autre profil ni à la connexion. */
async function effacerProfil(admin: Admin, profile: { id: string; role: Role }) {
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
         emporter aussi les envois jamais enregistrés.
         Les coordonnées partent avec : un ancien client lit encore la
         boutique par ses fils (`i_talk_with_merchant`, 0016), et l'écran
         promet d'effacer le téléphone — le WhatsApp en est un. Le nom
         de la boutique reste, pour que ces fils disent à qui ils
         parlaient. */
      const { error: photoError } = await admin
        .from("merchants")
        .update({ photo_path: null, whatsapp_phone: null, address_hint: null, description: null })
        .eq("id", merchant.id);
      if (photoError) throw photoError;
      const { data: fichiers } = await admin.storage.from(SHOP_PHOTOS_BUCKET).list(merchant.id);
      if (fichiers && fichiers.length > 0) {
        const { error: storageError } = await admin.storage
          .from(SHOP_PHOTOS_BUCKET)
          .remove(fichiers.map((fichier) => `${merchant.id}/${fichier.name}`));
        if (storageError) console.error("[suppression] photo de boutique restée :", storageError.message);
      }

      /* Les photos produit aussi : le bucket est PUBLIC, et masquer le
         produit ne ferme pas une adresse déjà partagée sur WhatsApp.
         Rangées en `{merchant_id}/{product_id}/{fichier}` (0004) : on
         parcourt les dossiers plutôt que `product_images`, pour
         emporter aussi les envois jamais enregistrés. Les lignes
         `product_images` partent aussi : elles ne désigneraient plus
         que des fichiers effacés. */
      const { data: produits, error: produitsError } = await admin
        .from("products")
        .select("id")
        .eq("merchant_id", merchant.id);
      if (produitsError) throw produitsError;
      // Par paquets : les identifiants voyagent dans l'URL de la requête.
      for (let i = 0; i < produits.length; i += 100) {
        const { error: imagesError } = await admin
          .from("product_images")
          .delete()
          .in("product_id", produits.slice(i, i + 100).map((produit) => produit.id));
        if (imagesError) throw imagesError;
      }
      await effacerPhotosProduits(admin, merchant.id);
    }
  }

  // `throw` : en `service_role` le RLS n'écarte rien, une erreur est une
  // panne. Si l'anonymisation échoue et que le bannissement réussit, la
  // personne perd l'accès en laissant son nom en base. D'où cet ordre :
  // tout ce qui suit est rejouable, et l'écran de confirmation reste
  // ouvert tant que la connexion l'est, pour relancer un bannissement
  // qui aurait échoué.
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

/** Ferme la connexion : appareils oubliés, email libéré, accès coupé. */
async function couperConnexion(admin: Admin, userId: string) {
  /* Explicitement : `0023` compte sur `on delete cascade` depuis
     `auth.users`, mais on BANNIT au lieu de supprimer, donc la cascade ne
     se déclenche jamais. Un abonnement push porte un identifiant
     d'appareil ; le garder contredit ce que ce bouton promet. */
  const { error: pushError } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("auth_user_id", userId);
  if (pushError) throw pushError;
  // Les téléphones de l'app mobile (0035), pour la même raison.
  const { error: telephonesError } = await admin
    .from("expo_push_tokens")
    .delete()
    .eq("auth_user_id", userId);
  if (telephonesError) throw telephonesError;

  /* L'EMAIL est libéré en même temps que l'accès est coupé : la ligne
     `auth.users` survit (voir plus haut), et tant qu'elle portait
     l'adresse, se réinscrire avec elle répondait « un compte existe
     déjà ». Remplacée par une adresse propre à cette ligne, sur `.invalid`
     (domaine réservé, RFC 2606 : rien n'y sera jamais envoyé), elle se
     réutilise pour un compte NEUF, sans rien hériter de l'ancien. Les
     métadonnées d'inscription (nom, téléphone, copie de l'email) partent : ce bouton
     promet de les effacer. `null` et non `{}` : Supabase FUSIONNE les
     métadonnées, un objet vide n'efface rien.
     Un seul appel : l'adresse libérée sur un compte encore ouvert
     laisserait une connexion sans email pour se retrouver.
     ~100 ans : Supabase n'a pas de bannissement permanent dédié. */
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    email: `supprime-${userId}@filloo.invalid`,
    email_confirm: true,
    user_metadata: { full_name: null, phone: null, email: null },
    ban_duration: "876000h",
  });
  if (banError) throw banError;
}

/* Journalise au lieu de lever, comme la photo de boutique : un fichier
   resté ne doit pas bloquer l'effacement du nom et du téléphone. */
async function effacerPhotosProduits(admin: Admin, merchantId: string) {
  const bucket = admin.storage.from("product-images");
  const { data: dossiers, error: listError } = await bucket.list(merchantId, { limit: 1000 });
  if (listError) {
    console.error("[suppression] photos produit restées :", listError.message);
    return;
  }
  for (const dossier of dossiers) {
    const { data: fichiers } = await bucket.list(`${merchantId}/${dossier.name}`, { limit: 1000 });
    if (!fichiers || fichiers.length === 0) continue;
    const { error: removeError } = await bucket.remove(
      fichiers.map((fichier) => `${merchantId}/${dossier.name}/${fichier.name}`),
    );
    if (removeError) console.error("[suppression] photos produit restées :", removeError.message);
  }
}
