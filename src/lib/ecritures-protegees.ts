import { createAdminClient } from "@/lib/supabase/admin";
import { erreurTelephone, nettoyerTelephone } from "@/lib/telephone";
import { erreurNom, lireIdEntier, longueur, texteNettoye } from "@/lib/saisie";

/**
 * Les écritures protégées par le mot de passe : nom et téléphone d'une
 * connexion, informations d'une boutique. Partagées par les formulaires
 * du site (`actions/account.ts`, `actions/merchants.ts`) et les routes de
 * l'app (`/api/app/mes-informations`, `/api/app/ma-boutique`).
 *
 * Depuis 0037, une session ne peut plus écrire ces colonnes : seul ce
 * fichier le fait, avec `service_role`, par les fonctions de 0036. Sans
 * cela, le mot de passe redemandé ne protégeait que l'écran.
 *
 * Hors de `src/lib/actions/` EXPRÈS, comme `suppression-compte.ts` : une
 * fonction exportée d'un fichier `"use server"` devient appelable depuis
 * n'importe quel navigateur, et celles-ci prennent un `authUserId` sans
 * vérifier qui le demande. Leurs appelants vérifient la session ET le mot
 * de passe avant de les appeler.
 */

/** Lit un champ de formulaire ou de corps JSON : `formData.get` ou `corps[champ]`. */
type Lire = (champ: string) => unknown;

export const ADRESSE_MAX = 200;
export const DESCRIPTION_BOUTIQUE_MAX = 1000;

/** `{merchant_id}/{uuid}.webp` — ou `.jpg` là où le navigateur n'encode
 * pas le WebP (Safari, 0031), et `.jpg` toujours depuis l'app. Que le
 * dossier soit bien CELUI de la boutique, c'est la base qui le garantit
 * (`merchants_photo_path_dans_son_dossier`, 0029). */
export const CHEMIN_PHOTO = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg)$/;

export type ChampsBoutique = {
  shopName: string;
  cityId: number;
  addressHint: string;
  whatsappPhone: string;
  description: string;
};

/** Les champs d'une boutique, lus ET validés en un geste, pour la
 * création comme pour la modification. Le nom est ce qu'un client lit en
 * premier : trois caractères invisibles ou 5 000 lettres passaient, et
 * une ville forgée (`1.5`, `999`) faisait répondre la base en anglais
 * (2026-09-25). */
export function lireBoutique(lire: Lire): ChampsBoutique | { error: string } {
  const shopName = texteNettoye(lire("shopName"));
  const cityId = lireIdEntier(lire("cityId"));
  const addressHint = texteNettoye(lire("addressHint"));
  const whatsappPhone = String(lire("whatsappPhone") ?? "").trim();
  const description = texteNettoye(lire("description"));

  if (!shopName || !cityId) {
    return { error: "Le nom de la boutique et la ville sont obligatoires." };
  }
  const erreurNomBoutique = erreurNom(shopName, "Nom de la boutique");
  if (erreurNomBoutique) return { error: erreurNomBoutique };
  if (longueur(addressHint) > ADRESSE_MAX) return { error: `« Où vous trouver » : ${ADRESSE_MAX} caractères maximum.` };
  if (longueur(description) > DESCRIPTION_BOUTIQUE_MAX) {
    return { error: `La description : ${DESCRIPTION_BOUTIQUE_MAX} caractères maximum.` };
  }
  const erreurWhatsapp = erreurTelephone(whatsappPhone, false, "WhatsApp");
  if (erreurWhatsapp) return { error: erreurWhatsapp };

  return { shopName, cityId, addressHint, whatsappPhone, description };
}

/** Nom et téléphone d'une connexion, lus et validés. */
export function lireInformations(lire: Lire): { fullName: string; phone: string } | { error: string } {
  const fullName = texteNettoye(lire("fullName"));
  const phone = String(lire("phone") ?? "").trim();
  if (!fullName || !phone) return { error: "Le nom et le téléphone sont obligatoires." };
  const erreurNomComplet = erreurNom(fullName, "Nom complet");
  if (erreurNomComplet) return { error: erreurNomComplet };
  const erreurNumero = erreurTelephone(phone, true);
  if (erreurNumero) return { error: erreurNumero };
  return { fullName, phone };
}

/**
 * Nom et téléphone sur TOUS les profils de la connexion (ils appartiennent
 * à la connexion, pas au rôle). Rend le nombre de profils écrits : zéro
 * veut dire « rien d'enregistré », jamais un succès.
 */
export async function ecrireMesInformations(authUserId: string, fullName: string, phone: string) {
  return createAdminClient().rpc("modifier_mes_informations", {
    p_auth_user_id: authUserId,
    p_nom: fullName,
    p_telephone: nettoyerTelephone(phone),
  });
}

/**
 * La boutique de la connexion, si son profil commerçant est actif. Rend
 * l'id de la boutique, ou `null` si rien n'a été écrit. Un champ vide
 * part en `''`, enregistré `null` par la base (0036).
 */
export async function ecrireMaBoutique(authUserId: string, champs: ChampsBoutique, photoPath: string) {
  return createAdminClient().rpc("modifier_ma_boutique", {
    p_auth_user_id: authUserId,
    p_nom: champs.shopName,
    p_ville_id: champs.cityId,
    p_adresse: champs.addressHint,
    p_whatsapp: nettoyerTelephone(champs.whatsappPhone),
    p_description: champs.description,
    p_photo_path: photoPath,
  });
}
