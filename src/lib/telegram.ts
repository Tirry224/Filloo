import { after } from "next/server";
import { siteUrl } from "@/lib/site-url";

/**
 * Les ALERTES du porteur du projet, sur Telegram (demande du 2026-11-13) :
 * inscriptions, boutiques à approuver, signalements, publications
 * refusées, erreurs du serveur. Elles vont à LUI SEUL, jamais à un
 * utilisateur.
 *
 * Née d'un cas précis : le 2026-11-13, une commerçante sur iPhone a
 * échoué quatre fois à publier, et rien ne disait pourquoi — le formulaire
 * avait répondu par un refus, invisible pour nous.
 *
 * Deux variables, côté serveur seulement (jamais `NEXT_PUBLIC_`) :
 * `TELEGRAM_BOT_TOKEN` (donné par @BotFather) et `TELEGRAM_CHAT_ID` (la
 * conversation qui reçoit). Sans elles, rien ne part : le poste local
 * reste muet.
 *
 * CE QU'ON N'ENVOIE JAMAIS : email, téléphone, mot de passe, contenu d'un
 * message privé. Telegram est un service tiers ; un nom de personne ou de
 * boutique y suffit, l'équipe retrouve le reste dans `/admin`.
 */

const LONGUEUR_MAX = 3500; // Telegram refuse au-delà de 4 096 caractères.
const DELAI_MS = 5000;

/** Même erreur, une fois par fenêtre et par instance : une page cassée
 * visitée cent fois ne doit pas faire sonner le téléphone cent fois. */
const DEJA_ENVOYE = new Map<string, number>();
const FENETRE_MS = 10 * 60 * 1000;

function prefixe(): string {
  const env = process.env.VERCEL_ENV;
  // La préversion partage la base de production : ses alertes sont
  // vraies, mais doivent se reconnaître.
  return env && env !== "production" ? "[préversion] " : "";
}

async function envoyer(texte: string): Promise<void> {
  const jeton = process.env.TELEGRAM_BOT_TOKEN;
  const conversation = process.env.TELEGRAM_CHAT_ID;
  if (!jeton || !conversation) return;
  try {
    const reponse = await fetch(`https://api.telegram.org/bot${jeton}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: conversation,
        text: (prefixe() + texte).slice(0, LONGUEUR_MAX),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(DELAI_MS),
    });
    // Jamais le jeton dans le journal : il est dans l'adresse.
    if (!reponse.ok) console.error(`[telegram] alerte refusée : ${reponse.status}`);
  } catch (cause) {
    console.error("[telegram] alerte non envoyée :", cause instanceof Error ? cause.name : cause);
  }
}

/**
 * À appeler depuis une action serveur : l'envoi part APRÈS la réponse
 * (`after`), l'utilisateur n'attend jamais Telegram, et une panne de
 * Telegram ne casse aucune action.
 */
export function alerter(texte: string): void {
  try {
    after(() => envoyer(texte));
  } catch {
    // Hors requête (script, test) : `after` n'existe pas.
    void envoyer(texte);
  }
}

/** Pour `onRequestError`, où `after` n'est pas disponible : on attend. */
export async function alerterErreur(cle: string, texte: string): Promise<void> {
  const maintenant = Date.now();
  const derniere = DEJA_ENVOYE.get(cle);
  if (derniere && maintenant - derniere < FENETRE_MS) return;
  DEJA_ENVOYE.set(cle, maintenant);
  await envoyer(texte);
}

/** Un lien vers une page du site, quand l'adresse est connue. */
export function lien(chemin: string): string {
  const base = siteUrl();
  return base ? `${base}${chemin}` : chemin;
}

export function libelleRole(role: string): string {
  return role === "merchant" ? "commerçant" : "client";
}
