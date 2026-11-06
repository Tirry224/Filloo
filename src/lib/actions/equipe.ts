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
  const chemin = `/admin/fil/${filDe}?espace=${espace}`;
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
  retour(chemin);
}

/** Publier une annonce : les destinataires sont figés par la base à cet instant (0042). */
export async function publierAnnonceAction(formData: FormData): Promise<void> {
  const chemin = "/admin/annonces";
  const titre = texteNettoye(formData.get("titre"));
  const corps = texteNettoye(formData.get("corps"));
  const publicVise = formData.get("public");
  if (!titre || !corps) retour(chemin, "Le titre et le texte sont obligatoires.");
  if (longueur(titre) > TITRE_MAX) retour(chemin, `Titre : ${TITRE_MAX} caractères au plus.`);
  if (longueur(corps) > CORPS_MAX) retour(chemin, `Texte : ${CORPS_MAX} caractères au plus.`);
  if (typeof publicVise !== "string" || !(publicVise in PUBLICS)) retour(chemin, "Choisissez à qui l'envoyer.");

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) retour("/connexion");

  const { data, error } = await supabase
    .from("annonces")
    .insert({
      auteur_id: user.id,
      titre,
      corps,
      public: publicVise as Database["public"]["Enums"]["public_annonce"],
    })
    .select("id")
    .single();
  if (error || !data) retour(chemin, error ? messagePourErreur(error, "annonce") : "Annonce non publiée.");

  after(() => annoncerAuxDestinataires(data.id));
  retour(chemin, undefined, "Annonce publiée.");
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
