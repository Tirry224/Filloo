"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/data/session";
import { PUBLICS } from "@/lib/data/equipe";
import { messagePourErreur } from "@/lib/erreurs";
import { estUuid, longueur, texteNettoye } from "@/lib/saisie";
import { annoncerAuxDestinataires, prevenirDeLaReponse } from "@/lib/notifications-equipe";
import type { Database } from "@/lib/database.types";

/** Les bornes de 0042. */
const CORPS_MAX = 2000;
const TITRE_MAX = 80;

function retour(chemin: string, erreur?: string, info?: string): never {
  const params = new URLSearchParams();
  if (erreur) params.set("erreur", erreur);
  if (info) params.set("info", info);
  const q = params.toString();
  redirect(`${chemin}${q ? `?${q}` : ""}`);
}

/**
 * L'équipe répond dans le fil d'une personne. Écrit AVEC la session : c'est
 * le RLS (0042) qui exige d'être de l'équipe et de signer de son nom.
 */
export async function repondreAuFilAction(formData: FormData): Promise<void> {
  const filDe = formData.get("filDe");
  if (!estUuid(filDe)) retour("/admin", "Fil introuvable.");
  const chemin = `/admin/fil/${filDe}`;
  const corps = texteNettoye(formData.get("corps"));
  if (!corps) retour(chemin, "Écrivez une réponse.");
  if (longueur(corps) > CORPS_MAX) retour(chemin, `${CORPS_MAX} caractères au plus.`);

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) retour("/connexion");

  const { error } = await supabase.from("fil_equipe").insert({ fil_de: filDe, auteur_id: user.id, de_l_equipe: true, corps });
  if (error) retour(chemin, messagePourErreur(error, "réponse"));

  after(() => prevenirDeLaReponse(filDe));
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
