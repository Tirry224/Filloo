"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getMyProfiles } from "@/lib/data/session";
import type { ActionState } from "@/lib/actions/auth";
import { refusMotDePasse } from "@/lib/supabase/verify";
import { messagePourErreur } from "@/lib/erreurs";
import { ecrireMesInformations, lireInformations } from "@/lib/ecritures-protegees";
import { supprimerProfil } from "@/lib/suppression-compte";

/**
 * Le nom et le téléphone appartiennent à la CONNEXION : `profiles` porte
 * ces colonnes par rôle (`unique (auth_user_id, role)`), donc n'écrire que
 * sur le profil client corrigerait le numéro à moitié.
 *
 * La ville de résidence du client n'est plus demandée (2026-10-22) : le
 * catalogue n'est plus filtré par ville. `profiles.city_id` reste en base,
 * l'app déjà installée l'écrit encore ; le site n'y touche plus.
 *
 * Colonnes modifiables : liste blanche de 0002 partie 4, complétée par 0010. */
export async function updateProfileAction(_prevState: ActionState | null, formData: FormData): Promise<ActionState> {
  const informations = lireInformations((champ) => formData.get(champ));
  if ("error" in informations) return informations;

  // Mot de passe exigé pour ÉCRIRE : ce numéro est celui par lequel un
  // commerçant rappelle, et le réécrire détournerait ces rappels.
  const currentPassword = String(formData.get("currentPassword") ?? "");
  if (!currentPassword) {
    return { error: "Entrez votre mot de passe actuel pour enregistrer." };
  }

  const supabase = await createClient();
  const profiles = await getMyProfiles(supabase);
  if (!profiles.some((p) => !p.isDeleted)) return { error: "Connectez-vous d'abord." };

  /* Vérifié AVANT la première écriture, pendant que rien n'a bougé.
     `refusMotDePasse` utilise un client jetable sans cookie, sinon une
     faute de frappe déconnecterait au milieu du formulaire (voir
     `src/lib/supabase/verify.ts`). */
  const user = await getSessionUser(supabase);
  if (!user?.email) {
    return { error: "Vérification impossible. Reconnectez-vous." };
  }
  const refus = await refusMotDePasse(user.email, currentPassword);
  if (refus) {
    return {
      error: refus.incorrect ? "Mot de passe incorrect. Rien n'est enregistré." : refus.message,
    };
  }

  /* Écrits par le serveur, sur TOUS les profils de la connexion (0036,
     0037) : la session seule ne peut plus toucher à ces colonnes, sans
     quoi le mot de passe ne protégerait que ce formulaire. Zéro profil
     écrit (compte supprimé entre-temps) n'est pas un enregistrement. */
  const { data: ecrits, error } = await ecrireMesInformations(user.id, informations.fullName, informations.phone);
  if (error) return { error: messagePourErreur(error, "compte") };
  if (!ecrits) {
    return { error: "Modification impossible. Reconnectez-vous." };
  }

  // L'espace vient du navigateur : il ne choisit qu'entre deux chemins
  // écrits ici. Même prudence que `safeNextPath`.
  redirect(formData.get("espace") === "merchant" ? "/vendeur/boutique" : "/compte");
}

/**
 * Supprimer mon compte — écran 18 : anonymisation, jamais un vrai DELETE
 * (docs/ECRANS.md). Le client RLS ne peut pas le
 * faire — `is_deleted`/`deleted_at` sont hors de la liste blanche de 0002
 * partie 4 — et couper l'accès à `auth.users` exige `service_role` ; les
 * deux doivent arriver ENSEMBLE, d'où la connexion `admin`.
 *
 * UN compte à la fois (2026-10-23) : supprimer le compte client laisse la
 * boutique intacte, et inversement. Deux actions, une par espace, plutôt
 * qu'un champ du formulaire : c'est la route qui décide quel compte
 * disparaît, comme elle décide de l'espace partout ailleurs.
 *
 * `auth.users` n'est PAS supprimé : `messages.sender_id` référence
 * `profiles` SANS cascade, donc un `deleteUser` échouerait sur une clé
 * étrangère. Quand plus aucun compte ne reste, un BANNISSEMENT coupe
 * l'accès en laissant l'historique lisible, et l'email est remplacé pour
 * pouvoir resservir.
 */
export async function deleteClientAccountAction(formData: FormData) {
  await supprimerMonCompte(formData, "client");
}

export async function deleteMerchantAccountAction(formData: FormData) {
  await supprimerMonCompte(formData, "merchant");
}

const ECRAN_SUPPRESSION = {
  client: "/compte/informations/supprimer",
  merchant: "/vendeur/informations/supprimer",
} as const;

async function supprimerMonCompte(formData: FormData, role: "client" | "merchant"): Promise<never> {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/connexion");
  const ecran = ECRAN_SUPPRESSION[role];

  /* Mot de passe exigé, comme pour changer de téléphone : un téléphone
     laissé déverrouillé ne doit pas suffire à effacer un compte. */
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const refus =
    user.email && currentPassword
      ? await refusMotDePasse(user.email, currentPassword)
      : { incorrect: true, trop: false, message: "" };
  if (refus) {
    const texte = refus.incorrect
      ? "Mot de passe incorrect. Compte non supprimé."
      : `${refus.message} Compte non supprimé.`;
    redirect(`${ecran}?erreur=${encodeURIComponent(texte)}`);
  }

  /* Un échec REVIENT sur l'écran de confirmation au lieu de lever : levée,
     l'erreur tombait sur `error.tsx`, et la personne concluait à une panne
     de réseau pour un compte resté intact. Le détail part dans les
     journaux Vercel, préfixé pour s'y chercher. */
  let connexionFermee: boolean;
  try {
    ({ connexionFermee } = await supprimerProfil(user.id, role));
  } catch (erreur) {
    console.error("[suppression] compte non supprimé :", erreur instanceof Error ? erreur.message : erreur);
    redirect(
      `${ecran}?erreur=${encodeURIComponent(
        "Suppression impossible. Réessayez plus tard.",
      )}`,
    );
  }

  if (connexionFermee) {
    await supabase.auth.signOut();
    redirect("/connexion");
  }
  // L'autre compte reste : on y entre, sans se reconnecter.
  revalidatePath("/", "layout");
  redirect(role === "client" ? "/vendeur" : "/compte");
}
