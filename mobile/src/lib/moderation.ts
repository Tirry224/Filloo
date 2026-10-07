import { supabase } from "./supabase";

/**
 * Bloquer, débloquer, signaler : mêmes règles que `src/lib/actions/messages.ts`
 * du site. Le RLS écarte en silence ce qu'il refuse (zéro ligne, pas
 * d'erreur) : on ne croit donc jamais un geste fait sans en avoir la preuve.
 */

/** Recopiés de `src/lib/mock.ts` du site : les mêmes mots des deux côtés. */
export const MOTIFS_FIL = [
  "Insultes ou menaces",
  "Tentative d'arnaque",
  "Messages répétés non désirés",
  "Demande d'argent à l'avance",
  "Autre",
];
export const MOTIFS_PRODUIT = ["Produit interdit ou illégal", "Photo trompeuse", "Prix ou description mensongers", "Contrefaçon", "Autre"];

/** La borne des précisions (`PRECISIONS_MAX` du site). */
export const PRECISIONS_MAX = 900;
export const DEJA_SIGNALE = "Vous l'avez déjà signalé : notre équipe n'a pas encore traité votre signalement.";

const INVISIBLES = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const nettoyer = (t: string) => t.replace(INVISIBLES, "").trim();

/** Je ne peux désigner que MOI comme bloqueur : bloquer veut dire « je me protège ». */
export async function bloquer(filId: string, monId: string): Promise<string | null> {
  const { data, error } = await supabase.from("conversations").update({ blocked_by: monId }).eq("id", filId).select("id");
  if (error || !data || data.length === 0) return "Blocage impossible. Réessayez.";
  return null;
}

/** Seul celui qui a bloqué peut débloquer (0032). */
export async function debloquer(filId: string): Promise<string | null> {
  const { data, error } = await supabase.from("conversations").update({ blocked_by: null }).eq("id", filId).select("id");
  if (error || !data || data.length === 0) return "Déblocage impossible. Réessayez.";
  return null;
}

type Resultat = { ok: true; message: string } | { ok: false; message: string };

async function signaler(opts: {
  reporterId: string;
  cible: "conversation" | "product";
  cibleId: string;
  motif: string;
  precisions: string;
  merci: string;
}): Promise<Resultat> {
  const precisions = nettoyer(opts.precisions);
  if (!opts.motif) return { ok: false, message: "Choisissez un motif de signalement." };
  if ([...precisions].length > PRECISIONS_MAX) return { ok: false, message: `Précisions : ${PRECISIONS_MAX} caractères maximum.` };
  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: opts.reporterId,
      target_type: opts.cible,
      target_id: opts.cibleId,
      reason: precisions ? `${opts.motif} — ${precisions}` : opts.motif,
    })
    .select("id");
  // 23505 : un signalement de cette personne attend déjà (index partiel de 0027). La plainte est reçue.
  if (error?.code === "23505") return { ok: true, message: DEJA_SIGNALE };
  if (error || !data || data.length === 0) return { ok: false, message: "Signalement impossible. Reconnectez-vous, puis réessayez." };
  return { ok: true, message: opts.merci };
}

export const signalerFil = (filId: string, monId: string, motif: string, precisions: string) =>
  signaler({
    reporterId: monId,
    cible: "conversation",
    cibleId: filId,
    motif,
    precisions,
    merci: "Signalement envoyé. Notre équipe va lire cette conversation.",
  });

/** N'importe lequel de mes profils actifs convient : « reports: je signale » ne distingue pas le rôle. */
export async function signalerProduit(authUserId: string, produitId: string, motif: string, precisions: string): Promise<Resultat> {
  const { data: profils } = await supabase
    .from("profiles")
    .select("id, is_suspended, is_deleted")
    .eq("auth_user_id", authUserId);
  const auteur = (profils ?? []).find((p) => !p.is_suspended && !p.is_deleted);
  if (!auteur) return { ok: false, message: "Votre compte ne permet pas de signaler. Reconnectez-vous, puis réessayez." };
  return signaler({
    reporterId: auteur.id,
    cible: "product",
    cibleId: produitId,
    motif,
    precisions,
    merci: "Signalement envoyé. Notre équipe va examiner ce produit.",
  });
}
