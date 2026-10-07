import type { Statut } from "./catalogue";
import { supabase } from "./supabase";

/**
 * La messagerie, CÔTÉ CLIENT seulement pour l'instant : mêmes requêtes que
 * `src/lib/data/messages.ts` et `src/lib/actions/messages.ts` du site. Le
 * RLS décide de tout — qui lit quel fil, qui peut y écrire — exactement
 * comme pour le site : l'app n'a aucun droit de plus.
 *
 * Ce que le site fait en plus, depuis son serveur, et que l'app ne fait
 * PAS encore : prévenir le destinataire (email, push) et compter les
 * mesures (`analytics_events`).
 */

const urlStockage = process.env.EXPO_PUBLIC_SUPABASE_URL;
const photoProduit = (chemin: string) => `${urlStockage}/storage/v1/object/public/product-images/${chemin}`;
const photoBoutique = (chemin: string) => `${urlStockage}/storage/v1/object/public/shop-photos/${chemin}`;

type Image = { storage_path: string; position: number };
const couverture = (images: Image[] | undefined) =>
  images && images.length > 0
    ? photoProduit(images.reduce((a, b) => (b.position < a.position ? b : a)).storage_path)
    : undefined;

/** La borne de `messages.body` (0001). */
export const MESSAGE_MAX = 2000;

/** Les caractères invisibles qui passaient pour un message (recopié de `saisie.ts` du site). */
const INVISIBLES = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
export const nettoyer = (texte: string) => texte.replace(INVISIBLES, "").trim();

export type ProfilClient = { id: string; suspendu: boolean };

/** Le compte client de la connexion, s'il existe (un commerçant seul n'en a pas). */
export async function lireProfilClient(authUserId: string): Promise<ProfilClient | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, is_suspended, is_deleted")
    .eq("auth_user_id", authUserId)
    .eq("role", "client")
    .maybeSingle();
  if (error) throw error;
  if (!data || data.is_deleted) return null;
  return { id: data.id, suspendu: data.is_suspended };
}

/** La boutique de la connexion, pour ne pas se contacter soi-même. */
export async function lireMaBoutiqueId(authUserId: string): Promise<string | null> {
  const { data: profil } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("role", "merchant")
    .maybeSingle();
  if (!profil) return null;
  const { data } = await supabase.from("merchants").select("id").eq("profile_id", profil.id).maybeSingle();
  return data?.id ?? null;
}

export type ResultatContact = { type: "pret"; filId: string } | { type: "refuse"; raison: string };

/**
 * Le fil (client, boutique), créé s'il n'existe pas. Chercher d'abord : le
 * quota de 20 nouvelles boutiques par jour (décision 13) ne compte que les
 * fils NOUVEAUX. Un double tap peut tenter deux créations ; la contrainte
 * `unique (client_id, merchant_id)` garantit un seul fil, et une course
 * perdue (23505) se règle en relisant.
 */
export async function ouvrirFil(clientId: string, boutiqueId: string): Promise<ResultatContact> {
  const chercher = () =>
    supabase.from("conversations").select("id").eq("client_id", clientId).eq("merchant_id", boutiqueId).maybeSingle();

  const { data: existant, error: erreurLecture } = await chercher();
  if (erreurLecture) throw erreurLecture;
  if (existant) return { type: "pret", filId: existant.id };

  const { data: cree, error } = await supabase
    .from("conversations")
    .insert({ client_id: clientId, merchant_id: boutiqueId })
    .select("id")
    .single();
  if (!error) return { type: "pret", filId: cree.id };
  // P0001 : le refus du quota, rédigé en français dans la migration.
  if (error.code === "P0001") return { type: "refuse", raison: error.message };
  if (error.code !== "23505") throw error;
  const { data: gagnant, error: erreurCourse } = await chercher();
  if (erreurCourse) throw erreurCourse;
  if (!gagnant) throw error;
  return { type: "pret", filId: gagnant.id };
}

export type ResumeFil = {
  id: string;
  interlocuteur: string;
  photoUrl?: string;
  dernierMessage: string;
  dernierQuand: string;
  produit: string;
  produitPhotoUrl?: string;
  nonLus: number;
};

/** Mes fils de client, du plus récent au plus ancien, avec leur dernier message et leurs non-lus. */
export async function listerMesFils(clientId: string): Promise<ResumeFil[]> {
  const { data: fils, error } = await supabase
    .from("conversations")
    .select("id, merchants(shop_name, photo_path)")
    .eq("client_id", clientId)
    .order("last_message_at", { ascending: false })
    .returns<{ id: string; merchants: { shop_name: string; photo_path: string | null } | null }[]>();
  if (error) throw error;
  if (fils.length === 0) return [];

  const { data: messages, error: erreurMessages } = await supabase
    .from("messages")
    .select("conversation_id, sender_id, body, read_at, created_at, products(title, product_images(storage_path, position))")
    .in(
      "conversation_id",
      fils.map((f) => f.id),
    )
    .order("created_at", { ascending: false })
    .returns<
      {
        conversation_id: string;
        sender_id: string;
        body: string;
        read_at: string | null;
        created_at: string;
        products: { title: string; product_images: Image[] } | null;
      }[]
    >();
  if (erreurMessages) throw erreurMessages;

  /* Les messages arrivent du plus récent au plus ancien : le premier vu
     d'un fil est son dernier message ; le produit est le dernier cité. */
  const resumes = new Map<string, Omit<ResumeFil, "id" | "interlocuteur" | "photoUrl">>();
  for (const m of messages) {
    const nonLu = m.read_at === null && m.sender_id !== clientId ? 1 : 0;
    const r = resumes.get(m.conversation_id);
    if (!r) {
      resumes.set(m.conversation_id, {
        dernierMessage: m.body,
        dernierQuand: heureDuMessage(m.created_at),
        produit: m.products?.title ?? "",
        produitPhotoUrl: couverture(m.products?.product_images),
        nonLus: nonLu,
      });
      continue;
    }
    r.nonLus += nonLu;
    if (!r.produit && m.products?.title) {
      r.produit = m.products.title;
      r.produitPhotoUrl = couverture(m.products.product_images);
    }
  }

  return fils.map((f) => ({
    id: f.id,
    interlocuteur: f.merchants?.shop_name ?? "",
    photoUrl: f.merchants?.photo_path ? photoBoutique(f.merchants.photo_path) : undefined,
    dernierMessage: "",
    dernierQuand: "",
    produit: "",
    nonLus: 0,
    ...resumes.get(f.id),
  }));
}

export type ContexteFil = {
  id: string;
  interlocuteur: string;
  photoUrl?: string;
  boutiqueId: string;
  monId: string;
  bloquePar: string | null;
  /** `false` si l'un des deux comptes est suspendu ou supprimé : lecture seule (0017, 0022). */
  ouvert: boolean;
};

/**
 * Le fil vu du côté client. `null` si ce n'est pas un fil dont je suis le
 * CLIENT : le RLS le cache s'il n'est pas à moi, et le côté commerçant
 * viendra avec l'espace commerçant.
 */
export async function lireContexteFil(filId: string, clientId: string): Promise<ContexteFil | null> {
  /* `conversation_is_open` est la fonction même qui décide, dans la policy
     d'envoi, si un message passera : la redemander ici évite de promettre
     un champ de saisie qu'on refuserait ensuite. */
  const [{ data, error }, { data: ouvert, error: erreurOuvert }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, client_id, blocked_by, merchants(id, shop_name, photo_path)")
      .eq("id", filId)
      .maybeSingle<{
        id: string;
        client_id: string;
        blocked_by: string | null;
        merchants: { id: string; shop_name: string; photo_path: string | null } | null;
      }>(),
    supabase.rpc("conversation_is_open", { cid: filId }),
  ]);
  if (error) throw error;
  if (erreurOuvert) throw erreurOuvert;
  if (!data?.merchants || data.client_id !== clientId) return null;
  return {
    id: data.id,
    interlocuteur: data.merchants.shop_name,
    photoUrl: data.merchants.photo_path ? photoBoutique(data.merchants.photo_path) : undefined,
    boutiqueId: data.merchants.id,
    monId: clientId,
    bloquePar: data.blocked_by,
    ouvert: ouvert === true,
  };
}

export type ProduitCite = { id: string; titre: string; prixGnf: number; statut: Statut; photoUrl?: string };
export type Message = { id: string; moi: boolean; texte: string; quand: string; produit: ProduitCite | null };

export async function lireMessages(filId: string, monId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at, product_id, products(title, price_gnf, status, product_images(storage_path, position))")
    .eq("conversation_id", filId)
    .order("created_at", { ascending: true })
    .returns<
      {
        id: string;
        sender_id: string;
        body: string;
        created_at: string;
        product_id: string | null;
        products: { title: string; price_gnf: number; status: Statut; product_images: Image[] } | null;
      }[]
    >();
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    moi: m.sender_id === monId,
    texte: m.body,
    quand: heureDuMessage(m.created_at),
    produit:
      m.product_id && m.products
        ? {
            id: m.product_id,
            titre: m.products.title,
            prixGnf: m.products.price_gnf,
            statut: m.products.status,
            photoUrl: couverture(m.products.product_images),
          }
        : null,
  }));
}

/** Envoie un message ; renvoie le texte d'erreur à afficher, ou `null` si c'est parti. */
export async function envoyerMessage(opts: {
  filId: string;
  monId: string;
  texte: string;
  produitId: string | null;
}): Promise<string | null> {
  const texte = nettoyer(opts.texte);
  if (!texte) return "Écrivez un message avant d'envoyer.";
  if ([...texte].length > MESSAGE_MAX) {
    return `Message trop long : ${MESSAGE_MAX} caractères maximum. Coupez-le en deux.`;
  }
  const { error } = await supabase.from("messages").insert({
    conversation_id: opts.filId,
    sender_id: opts.monId,
    body: texte,
    product_id: opts.produitId,
  });
  if (!error) return null;
  // Bloqué, compte suspendu, boutique suspendue : un seul sens pour l'expéditeur.
  if (error.code === "42501") return "Ce fil n'accepte plus de nouveaux messages. Vos échanges restent consultables.";
  // `raise exception` des triggers, rédigés en français (premier message sans produit, etc.).
  if (error.code === "P0001") return error.message;
  if (error.message.includes("Network request failed")) return "Pas de connexion internet. Votre message n'est pas parti.";
  console.error("[messages]", error.code, error.message);
  return "Une erreur est survenue. Réessayez dans un instant.";
}

/** Marque comme lus les messages REÇUS de ce fil (jamais les miens : policy de 0002). */
export async function marquerLu(filId: string, monId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", filId)
    .is("read_at", null)
    .neq("sender_id", monId);
  if (error) console.error("[messages] marquage lu impossible :", error.message);
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 14:05 » aujourd'hui, « Hier », sinon « 3 oct. » — écrit à la main plutôt qu'avec `Intl`, dont le support varie. */
export function heureDuMessage(iso: string): string {
  const date = new Date(iso);
  const maintenant = new Date();
  if (date.toDateString() === maintenant.toDateString()) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  const hier = new Date(maintenant);
  hier.setDate(maintenant.getDate() - 1);
  if (date.toDateString() === hier.toDateString()) return "Hier";
  return `${date.getDate()} ${MOIS[date.getMonth()]}`;
}
