"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { passwordIsValid } from "@/lib/supabase/verify";
import { erreurNouveauMotDePasse } from "@/lib/password";
import { erreurTelephone, nettoyerTelephone } from "@/lib/telephone";
import { getMyProfile, getSessionUser } from "@/lib/data/session";
import type { ActionState } from "@/lib/actions/auth";

/** Écran 13 — création de la boutique, étape 2 de l'inscription commerçant.
 * La policy "merchants: je cree ma boutique" (0002) vérifie déjà que
 * `profile_id` appartient au commerçant connecté ; inutile de le
 * revérifier ici, mais on a besoin de l'id pour l'insertion. */
export async function createMerchantAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const shopName = String(formData.get("shopName") ?? "").trim();
  const cityId = Number(formData.get("cityId") ?? 0);
  const addressHint = String(formData.get("addressHint") ?? "").trim();
  const whatsappPhone = String(formData.get("whatsappPhone") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!shopName || !cityId) {
    return { error: "Le nom de la boutique et la ville sont obligatoires." };
  }
  /* Le WhatsApp n'est PAS obligatoire — tous les commerçants n'en ont
     pas — mais s'il est renseigné il doit être joignable : un numéro
     à sept chiffres affiché sous une boutique est pire que pas de
     numéro du tout, parce que le client croit avoir un recours. */
  const erreurWhatsapp = erreurTelephone(whatsappPhone, false, "WhatsApp");
  if (erreurWhatsapp) return { error: erreurWhatsapp };

  const supabase = await createClient();
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchantProfile) return { error: "Vous devez d'abord créer un compte commerçant." };

  const { error } = await supabase.from("merchants").insert({
    profile_id: merchantProfile.id,
    shop_name: shopName,
    city_id: cityId,
    address_hint: addressHint || null,
    whatsapp_phone: nettoyerTelephone(whatsappPhone) || null,
    description: description || null,
  });
  if (error) {
    if (error.code === "23505") return { error: "Vous avez déjà une boutique." };
    return { error: error.message };
  }

  redirect("/vendeur/attente");
}

/**
 * Renvoyer ma boutique à la vérification — écran 21, après correction.
 *
 * C'est la flèche qui manquait au parcours « refusée → correction →
 * renvoi → attente » : corriger ses informations n'a JAMAIS changé
 * `merchants.status`, donc une boutique refusée le restait indéfiniment
 * quoi que son propriétaire corrige.
 *
 * Le statut n'est pas écrit ici : il l'est par `resubmit_my_merchant()`
 * (0015), en base, qui n'autorise qu'une seule transition
 * ('rejected' → 'pending') et seulement sur la boutique de la connexion
 * qui appelle. Le commerçant n'a toujours aucun droit d'écriture sur
 * `merchants.status` — s'auto-valider reste impossible, et c'est bien la
 * base qui le garantit, pas cet écran.
 *
 * Une `<form>` de composant serveur, sans `useActionState` : comme les
 * actions produit, elle fonctionne sans JavaScript, et son message
 * d'erreur voyage donc dans l'URL, lu par `Notice` sur `/vendeur/refusee`.
 */
export async function resubmitMerchantAction() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resubmit_my_merchant");
  // Les messages de la fonction sont déjà écrits en français pour être lus
  // tels quels, comme ceux des triggers de 0002.
  if (error) redirect(`/vendeur/refusee?erreur=${encodeURIComponent(error.message)}`);
  redirect("/vendeur/attente");
}

/**
 * Modifier ma boutique — écran 26. Ne touche jamais `status` : contrairement
 * à ce que la maquette affichait, changer le nom ou la ville ne déclenche
 * PAS de nouvelle vérification — aucune règle de la base ne le fait, et en
 * ajouter une ferait disparaître du catalogue public les produits déjà en
 * ligne (la policy "products: catalogue public" exige une boutique
 * `approved`). Contradiction encore ouverte, à trancher avec le porteur du
 * projet avant de réintroduire ce texte — voir docs/REPRISE.md.
 */
export async function updateMerchantAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const shopName = String(formData.get("shopName") ?? "").trim();
  const cityId = Number(formData.get("cityId") ?? 0);
  const addressHint = String(formData.get("addressHint") ?? "").trim();
  const whatsappPhone = String(formData.get("whatsappPhone") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const newPasswordConfirmation = String(formData.get("newPasswordConfirmation") ?? "");

  if (!shopName || !cityId) {
    return { error: "Le nom de la boutique et la ville sont obligatoires." };
  }
  const erreurWhatsapp = erreurTelephone(whatsappPhone, false, "WhatsApp");
  if (erreurWhatsapp) return { error: erreurWhatsapp };

  /* TOUT CE QUI PEUT ÊTRE REFUSÉ L'EST AVANT LA PREMIÈRE ÉCRITURE.
     Ces deux systèmes — `auth.users` pour le mot de passe, `merchants`
     pour la boutique — ne partagent aucune transaction : rien ne peut
     annuler l'un si l'autre échoue. La seule protection possible est donc
     de refuser TÔT, pour que l'étape qui écrit ne trouve plus de raison
     d'échouer. Ce qui reste après ces contrôles ne tombe qu'en cas de
     panne réseau, et ce cas-là est dit à l'écran (voir plus bas). */
  if (!currentPassword) {
    return { error: "Confirmez avec votre mot de passe actuel pour enregistrer." };
  }
  /* Le champ est FACULTATIF — vide, on garde le mot de passe actuel —
     mais dès qu'on y touche, la règle commune s'applique : longueur, et
     les deux saisies qui correspondent. */
  if (newPassword || newPasswordConfirmation) {
    const erreurMotDePasse = erreurNouveauMotDePasse(newPassword, newPasswordConfirmation);
    if (erreurMotDePasse) return { error: erreurMotDePasse };
  }

  const supabase = await createClient();
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchantProfile) return { error: "Vous devez être connecté en tant que commerçant." };

  /* LA CONFIRMATION PAR MOT DE PASSE, ET CE QU'ELLE PROTÈGE VRAIMENT
     Ces informations sont celles qu'un client lit avant de se déplacer :
     l'adresse où l'on vous trouve et le numéro WhatsApp. Quelqu'un qui
     emprunte un téléphone déverrouillé quelques secondes pouvait les
     réécrire sans rien connaître du compte — et rediriger vers lui les
     acheteurs d'une boutique qui n'est pas la sienne. Redemander le mot
     de passe au moment d'écrire est ce qui distingue « cette session est
     ouverte » de « c'est bien la bonne personne, maintenant ».

     Supabase n'a pas d'appel « vérifie ce mot de passe » : la seule façon
     de le savoir est de s'en servir pour se connecter. `passwordIsValid`
     le fait avec un client JETABLE, qui n'écrit aucun cookie — voir
     `src/lib/supabase/verify.ts` pour la raison, qui compte : le client de
     session aurait pu abîmer la session en cours sur un simple échec, et
     une faute de frappe qui déconnecte au milieu d'un formulaire à moitié
     rempli serait pire que le défaut qu'on corrige. */
  const user = await getSessionUser(supabase);
  if (!user?.email) {
    // Aucun compte du projet ne devrait être dans ce cas — l'inscription
    // passe toujours par un email. On refuse plutôt que d'enregistrer sans
    // avoir pu vérifier quoi que ce soit.
    return { error: "Impossible de vérifier votre mot de passe. Reconnectez-vous, puis réessayez." };
  }

  if (!(await passwordIsValid(user.email, currentPassword))) {
    // Message volontairement sec : il ne dit rien de plus que « ce n'est
    // pas le bon ». Et il dit ce qui compte pour la personne — que rien
    // n'a bougé — plutôt que de la laisser deviner ce qui a été gardé.
    return { error: "Mot de passe actuel incorrect. Aucune modification n'a été enregistrée." };
  }

  const { data, error } = await supabase
    .from("merchants")
    .update({
      shop_name: shopName,
      city_id: cityId,
      address_hint: addressHint || null,
      whatsapp_phone: nettoyerTelephone(whatsappPhone) || null,
      description: description || null,
    })
    .eq("profile_id", merchantProfile.id)
    .select("id");
  if (error) return { error: error.message };
  // Même raison que le profil client : un `update` écarté par le RLS
  // répond un succès à zéro ligne. Une boutique dont les modifications
  // disparaissent sans message est la panne la plus décourageante pour un
  // commerçant qui vient de tout ressaisir.
  if (!data || data.length === 0) {
    return { error: "Enregistrement impossible. Reconnectez-vous, puis réessayez." };
  }

  /* LE MOT DE PASSE EN DERNIER, ET L'ORDRE EST UN CHOIX
     Les deux écritures ne sont pas atomiques ; il faut donc décider
     laquelle risque de rester seule. La boutique passe d'abord parce
     qu'elle est la raison d'être de cet écran : si le changement de mot
     de passe échoue après elle, on peut le DIRE — « vos informations sont
     enregistrées, le mot de passe n'a pas changé » — et la personne
     réessaie juste ce point. L'ordre inverse laisserait quelqu'un avec un
     nouveau mot de passe et un formulaire à ressaisir, sans savoir lequel
     des deux a pris.

     À ce stade le mot de passe actuel a déjà été vérifié : ce qui suit ne
     peut plus échouer que sur une panne, jamais sur une saisie. */
  if (newPassword) {
    const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
    if (passwordError) {
      return {
        error:
          "Vos informations sont enregistrées, mais le mot de passe n'a pas pu être changé. Réessayez ce seul point.",
      };
    }
  }

  /* Retour sur la CONSULTATION, pas sur l'accueil. C'est la règle que
     l'écran d'édition pose : ses deux sorties — la flèche retour qui
     annule, et cet enregistrement — mènent au même endroit, celui d'où
     l'on vient. Renvoyer ailleurs obligerait à retrouver son écran pour
     vérifier ce qu'on vient d'écrire, et c'est précisément le moment où
     l'on veut le relire. */
  redirect("/vendeur/boutique");
}
