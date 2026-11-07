"use server";

import { revalidatePath } from "next/cache";
import { RedirectType, redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/data/session";
import { CHEMINS_EQUIPE, PUBLICS, lireEspace } from "@/lib/data/equipe";
import { messagePourErreur } from "@/lib/erreurs";
import { estUuid, longueur, texteNettoye } from "@/lib/saisie";
import { annoncerAuxDestinataires, prevenirDeLaReponse, prevenirLEquipe } from "@/lib/notifications-equipe";
import type { Database } from "@/lib/database.types";
import type { ActionState } from "@/lib/actions/auth";

/** Les bornes de 0042. */
const CORPS_MAX = 2000;
const TITRE_MAX = 80;

function retour(chemin: string, erreur?: string, info?: string): never {
  const params = new URLSearchParams();
  if (erreur) params.set("erreur", erreur);
  if (info) params.set("info", info);
  const q = params.toString();
  redirect(`${chemin}${q ? `${chemin.includes("?") ? "&" : "?"}${q}` : ""}`);
}

/**
 * L'équipe répond dans le fil d'une personne. Écrit AVEC la session : c'est
 * le RLS (0042) qui exige d'être de l'équipe et de signer de son nom.
 */
export async function repondreAuFilAction(formData: FormData): Promise<void> {
  const filDe = formData.get("filDe");
  if (!estUuid(filDe)) retour("/admin", "Fil introuvable.");
  // Le fil client ou le fil boutique de cette personne (0044).
  const espace = lireEspace(formData.get("espace"));
  /* Un premier message (fil vide) garde son `profil` : sans lui, la page
     d'un fil vide ne se rouvre pas pour montrer l'erreur. */
  const profil = formData.get("profil");
  const chemin = `/admin/fil/${filDe}?espace=${espace}${estUuid(profil) ? `&profil=${profil}` : ""}`;
  const corps = texteNettoye(formData.get("corps"));
  if (!corps) retour(chemin, "Écrivez une réponse.");
  if (longueur(corps) > CORPS_MAX) retour(chemin, `${CORPS_MAX} caractères au plus.`);

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) retour("/connexion");

  const { data, error } = await supabase
    .from("fil_equipe")
    .insert({ fil_de: filDe, espace, auteur_id: user.id, de_l_equipe: true, corps })
    .select("id")
    .single();
  if (error || !data) retour(chemin, error ? messagePourErreur(error, "réponse") : "Réponse non envoyée.");

  after(() => prevenirDeLaReponse(filDe, espace));
  /* Même piège que la discussion côté utilisateur : sans ceci, le routeur
     rendait le fil de son cache et la réponse n'apparaissait qu'en
     rechargeant (2026-11-06). La boîte aussi, pour « À répondre ». */
  revalidatePath(`/admin/fil/${filDe}`);
  revalidatePath("/admin");
  retour(chemin);
}

/* ---------------------------------------------------------------------
   Les annonces de l'équipe (0045, décision du 2026-11-06) : brouillon,
   programmée (part le matin du jour choisi), publiée, retirée. Tout membre
   de l'équipe peut tout faire ; la base date et signe, et refuse ce qui
   ferait reculer le cycle (ses refus, en français, s'affichent tels quels).
   --------------------------------------------------------------------- */

const ANNONCES = "/admin/annonces";

/** Une date « AAAA-MM-JJ » à partir de demain (le jour même partirait trop tard : le cron passe à 7 h). */
function lireDateProgrammee(valeur: unknown): string | null {
  if (typeof valeur !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const demain = new Date();
  demain.setUTCDate(demain.getUTCDate() + 1);
  return valeur >= demain.toISOString().slice(0, 10) ? valeur : null;
}

function lireTexteAnnonce(formData: FormData, chemin: string): { titre: string; corps: string } {
  const titre = texteNettoye(formData.get("titre"));
  const corps = texteNettoye(formData.get("corps"));
  if (!titre || !corps) retour(chemin, "Le titre et le texte sont obligatoires.");
  if (longueur(titre) > TITRE_MAX) retour(chemin, `Titre : ${TITRE_MAX} caractères au plus.`);
  if (longueur(corps) > CORPS_MAX) retour(chemin, `Texte : ${CORPS_MAX} caractères au plus.`);
  return { titre, corps };
}

function lirePublic(formData: FormData, chemin: string): Database["public"]["Enums"]["public_annonce"] {
  const publicVise = formData.get("public");
  if (typeof publicVise !== "string" || !(publicVise in PUBLICS)) retour(chemin, "Choisissez à qui l'envoyer.");
  return publicVise as Database["public"]["Enums"]["public_annonce"];
}

/** Créer une annonce : publiée tout de suite, en brouillon, ou programmée (`mode`). */
export async function creerAnnonceAction(formData: FormData): Promise<void> {
  const { titre, corps } = lireTexteAnnonce(formData, ANNONCES);
  const publicVise = lirePublic(formData, ANNONCES);
  const mode = formData.get("mode");
  const date = lireDateProgrammee(formData.get("date"));
  if (mode === "programmer" && !date) retour(ANNONCES, "Choisissez une date à partir de demain.");
  const etat = mode === "publier" ? "publiee" : mode === "programmer" ? "programmee" : "brouillon";

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) retour("/connexion");

  const { data, error } = await supabase
    .from("annonces")
    .insert({ auteur_id: user.id, titre, corps, public: publicVise, etat, programmee_pour: date })
    .select("id")
    .single();
  if (error || !data) retour(ANNONCES, error ? messagePourErreur(error, "annonce") : "Annonce non enregistrée.");

  if (etat === "publiee") after(() => annoncerAuxDestinataires(data.id));
  revalidatePath(ANNONCES);
  retour(
    `${ANNONCES}/${data.id}`,
    undefined,
    etat === "publiee" ? "Annonce publiée." : etat === "programmee" ? "Annonce programmée." : "Brouillon enregistré.",
  );
}

/** Modifier le texte (et le public, tant qu'elle n'est pas publiée). Publiée : mention « Modifiée », sans notification. */
export async function modifierAnnonceAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (!estUuid(id)) retour(ANNONCES, "Annonce introuvable.");
  const chemin = `${ANNONCES}/${id}`;
  const { titre, corps } = lireTexteAnnonce(formData, chemin);
  const changements: Database["public"]["Tables"]["annonces"]["Update"] = { titre, corps };
  if (formData.get("public") !== null) changements.public = lirePublic(formData, chemin);

  const supabase = await createClient();
  const { data, error } = await supabase.from("annonces").update(changements).eq("id", id).select("id");
  if (error) retour(chemin, error.code === "P0001" ? error.message : messagePourErreur(error, "annonce"));
  if (!data?.length) retour(chemin, "Modification impossible.");
  revalidatePath(ANNONCES);
  revalidatePath(chemin);
  retour(chemin, undefined, "Modifications enregistrées.");
}

/** Faire avancer une annonce : publier, programmer, repasser en brouillon, retirer ou supprimer (`action`). */
export async function changerEtatAnnonceAction(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (!estUuid(id)) retour(ANNONCES, "Annonce introuvable.");
  const chemin = `${ANNONCES}/${id}`;
  const action = formData.get("action");
  const supabase = await createClient();

  if (action === "supprimer") {
    const { data, error } = await supabase.from("annonces").delete().eq("id", id).select("id");
    if (error) retour(chemin, messagePourErreur(error, "annonce"));
    // Le RLS ne supprime qu'un brouillon ou une programmée : rien de supprimé = elle était publiée.
    if (!data?.length) retour(chemin, "Une annonce publiée ne se supprime pas : retirez-la.");
    revalidatePath(ANNONCES);
    retour(ANNONCES, undefined, "Brouillon supprimé.");
  }

  let changements: Database["public"]["Tables"]["annonces"]["Update"];
  let info: string;
  if (action === "publier") {
    changements = { etat: "publiee" };
    info = "Annonce publiée.";
  } else if (action === "programmer") {
    const date = lireDateProgrammee(formData.get("date"));
    if (!date) retour(chemin, "Choisissez une date à partir de demain.");
    changements = { etat: "programmee", programmee_pour: date };
    info = "Annonce programmée.";
  } else if (action === "brouillon") {
    changements = { etat: "brouillon" };
    info = "Programmation annulée : l'annonce est redevenue un brouillon.";
  } else if (action === "retirer") {
    changements = { etat: "retiree" };
    info = "Annonce retirée : elle n'apparaît plus chez les utilisateurs.";
  } else {
    retour(chemin, "Action inconnue.");
  }

  const { data, error } = await supabase.from("annonces").update(changements).eq("id", id).select("id");
  if (error) retour(chemin, error.code === "P0001" ? error.message : messagePourErreur(error, "annonce"));
  if (!data?.length) retour(chemin, "Action impossible.");
  if (action === "publier") after(() => annoncerAuxDestinataires(id));
  revalidatePath(ANNONCES);
  revalidatePath(chemin);
  retour(chemin, undefined, info);
}

/**
 * Une personne écrit à l'équipe depuis le site, en répondant ou non à une
 * annonce. Écrit AVEC la session : le RLS (0042) borne le fil à soi,
 * refuse un compte suspendu et une annonce qui ne m'était pas destinée.
 * Un refus revient DANS le formulaire (`useFormulaire`), saisie gardée ;
 * le succès ramène au fil.
 */
export async function ecrireALEquipeAction(_etat: ActionState | null, formData: FormData): Promise<ActionState> {
  const espace = lireEspace(formData.get("espace"));
  const chemin = CHEMINS_EQUIPE[espace];
  const corps = texteNettoye(formData.get("corps"));
  if (!corps) return { error: "Écrivez un message avant d'envoyer." };
  if (longueur(corps) > CORPS_MAX) return { error: `${CORPS_MAX} caractères au plus.` };

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Vous êtes déconnecté. Reconnectez-vous : votre message est gardé." };

  const { data, error } = await supabase
    .from("fil_equipe")
    .insert({
      fil_de: user.id,
      espace,
      auteur_id: user.id,
      de_l_equipe: false,
      corps,
      // On ne répond plus à une annonce (décision du 2026-11-05).
      annonce_id: null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      error:
        error?.code === "42501"
          ? "Votre compte ne peut plus envoyer de messages. Vos échanges restent consultables."
          : error
            ? messagePourErreur(error, "message")
            : "Message non envoyé.",
    };
  }

  after(() => prevenirLEquipe(data.id));
  /* Une seule discussion par espace (décision du 2026-11-05) : on y reste,
     et le message s'ajoute en bas. `replace` : renvoyer le formulaire ne
     crée pas une page de plus dans l'historique. */
  /* Sans ce `revalidatePath`, le routeur rendait la discussion de son
     cache (`staleTimes.dynamic` : 30 s, next.config.ts) : le message
     n'apparaissait qu'en rechargeant la page (constaté le 2026-11-06). */
  revalidatePath(`${chemin}/discussion`);
  redirect(`${chemin}/discussion`, RedirectType.replace);
}
