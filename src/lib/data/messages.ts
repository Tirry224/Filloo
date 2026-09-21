import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Message, Thread } from "@/lib/types";
import { productImageUrl } from "@/lib/storage";
import { getMyProfile, getSessionUser } from "@/lib/data/session";
import { getMyMerchant } from "@/lib/data/merchants";
import { formatMessageTime } from "@/lib/format";
import type { Espace } from "@/lib/espace";

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  product_id: string | null;
  products: { title: string; price_gnf: number; status: Database["public"]["Enums"]["product_status"] } | null;
};

/**
 * Un seul aller-retour pour TOUS les fils : vingt fils ne doivent pas
 * coûter vingt requêtes (leçon de `auth.getUser()`, docs/REPRISE.md §7).
 * Les messages sont lus une fois, du plus récent au plus ancien, puis
 * regroupés en mémoire.
 */
async function summarizeThreads(
  supabase: SupabaseClient<Database>,
  conversationIds: string[],
  myProfileId: string,
): Promise<Map<string, { lastMessage: string; lastAt: string; lastProductTitle: string; unreadCount: number }>> {
  const summaries = new Map<
    string,
    { lastMessage: string; lastAt: string; lastProductTitle: string; unreadCount: number }
  >();
  if (conversationIds.length === 0) return summaries;

  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id, sender_id, body, read_at, created_at, product_id, products(title)")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .returns<Pick<MessageRow, "conversation_id" | "sender_id" | "body" | "read_at" | "created_at" | "product_id" | "products">[]>();
  if (error) throw error;

  for (const row of data) {
    const existing = summaries.get(row.conversation_id);
    const isUnread = row.read_at === null && row.sender_id !== myProfileId;
    if (!existing) {
      summaries.set(row.conversation_id, {
        lastMessage: row.body,
        lastAt: formatMessageTime(row.created_at),
        lastProductTitle: row.products?.title ?? "",
        unreadCount: isUnread ? 1 : 0,
      });
    } else {
      if (isUnread) existing.unreadCount += 1;
      // Le produit cité le plus récent gagne ; à défaut, celui d'un
      // message plus ancien reste le meilleur « de quoi parle ce fil ».
      if (!existing.lastProductTitle && row.products?.title) {
        existing.lastProductTitle = row.products.title;
      }
    }
  }
  return summaries;
}

/** Mes fils, vus depuis mon compte CLIENT : l'interlocuteur est la boutique. */
export async function getMyThreadsAsClient(supabase: SupabaseClient<Database>): Promise<Thread[]> {
  const profile = await getMyProfile(supabase, "client");
  if (!profile) return [];

  const { data, error } = await supabase
    .from("conversations")
    .select("id, merchants(shop_name)")
    .eq("client_id", profile.id)
    .order("last_message_at", { ascending: false })
    .returns<{ id: string; merchants: { shop_name: string } | null }[]>();
  if (error) throw error;

  const summaries = await summarizeThreads(supabase, data.map((c) => c.id), profile.id);
  return data.map((c) => {
    const s = summaries.get(c.id);
    return {
      id: c.id,
      peerName: c.merchants?.shop_name ?? "",
      peerKind: "shop",
      lastProductTitle: s?.lastProductTitle ?? "",
      lastMessage: s?.lastMessage ?? "",
      lastAt: s?.lastAt ?? "",
      unreadCount: s?.unreadCount ?? 0,
    };
  });
}

/** Mes fils, vus depuis ma boutique : l'interlocuteur est une personne. */
export async function getMyThreadsAsMerchant(supabase: SupabaseClient<Database>): Promise<Thread[]> {
  const merchant = await getMyMerchant(supabase);
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (!merchant || !merchantProfile) return [];

  const { data, error } = await supabase
    .from("conversations")
    .select("id, profiles!conversations_client_id_fkey(full_name)")
    .eq("merchant_id", merchant.id)
    .order("last_message_at", { ascending: false })
    .returns<{ id: string; profiles: { full_name: string } | null }[]>();
  if (error) throw error;

  const summaries = await summarizeThreads(supabase, data.map((c) => c.id), merchantProfile.id);
  return data.map((c) => {
    const s = summaries.get(c.id);
    return {
      id: c.id,
      peerName: c.profiles?.full_name ?? "",
      peerKind: "person",
      lastProductTitle: s?.lastProductTitle ?? "",
      lastMessage: s?.lastMessage ?? "",
      lastAt: s?.lastAt ?? "",
      unreadCount: s?.unreadCount ?? 0,
    };
  });
}

export type ThreadContext = {
  conversationId: string;
  peerName: string;
  peerKind: "shop" | "person";
  /** Mon identifiant de participant DANS ce fil précis (mon profil client
   * ou mon profil commerçant, selon le côté où je me trouve). */
  myParticipantId: string;
  /** L'identifiant de boutique côté vendeur du fil — utile pour filtrer
   * les produits à citer, même quand je suis le client. */
  merchantId: string;
  /** `true` si je suis moi-même la boutique de ce fil. */
  iAmMerchant: boolean;
  blockedBy: string | null;
  /** L'identifiant public de la boutique, pour "Voir sa fiche" côté client. */
  merchantPublicId: string;
  /** `false` quand L'UN DES DEUX comptes du fil — le mien compris — est
   * suspendu ou supprimé : le fil passe en LECTURE SEULE (0017 côté
   * boutique, 0022 côté client), l'historique restant affiché. */
  isOpen: boolean;
  /** `true` quand c'est MON compte qui est suspendu. Choisit le texte du
   * fil gelé : sans cette distinction, on accuse le mauvais compte. */
  iAmSuspended: boolean;
};

/** Résout un fil pour la connexion active : qui je suis dedans, qui est en
 * face. RLS filtre déjà l'accès — un fil qui n'est pas le mien renvoie
 * `null` ici exactement comme s'il n'existait pas, jamais une erreur. */
export async function getThreadContext(
  supabase: SupabaseClient<Database>,
  conversationId: string,
): Promise<ThreadContext | null> {
  /* Sans session, ne pas POSER la question : `conversation_is_open` est
     révoquée à `anon` (0017), donc la RPC répondrait « permission
     refusée » à un visiteur, et une frontière d'erreur annoncerait une
     panne au lieu d'une page introuvable. Traité ici parce qu'aucune page
     de `/messages` n'exige de session en amont. */
  const user = await getSessionUser(supabase);
  if (!user) return null;

  /* L'ouverture du fil est demandée à la BASE (`conversation_is_open`,
     0017) : c'est la même fonction qui décide, dans la policy d'envoi, si
     le message passera. Dédoublée, la règle finirait par promettre un
     champ de saisie qu'on refuse ensuite. */
  const [{ data, error }, { data: isOpen, error: openError }] = await Promise.all([
    supabase
      .from("conversations")
      .select(
        "id, client_id, merchant_id, blocked_by, profiles!conversations_client_id_fkey(full_name), merchants(id, shop_name, profile_id)",
      )
      .eq("id", conversationId)
      .maybeSingle<{
        id: string;
        client_id: string;
        merchant_id: string;
        blocked_by: string | null;
        profiles: { full_name: string } | null;
        merchants: { id: string; shop_name: string; profile_id: string } | null;
      }>(),
    supabase.rpc("conversation_is_open", { cid: conversationId }),
  ]);
  if (error) throw error;
  if (openError) throw openError;
  if (!data || !data.merchants) return null;

  const merchantProfile = await getMyProfile(supabase, "merchant");
  const iAmMerchant = merchantProfile?.id === data.merchants.profile_id;

  // Le profil par lequel JE participe au fil, pour savoir si la
  // suspension qui le gèle est la mienne. En cache, donc gratuit.
  const myProfile = iAmMerchant ? merchantProfile : await getMyProfile(supabase, "client");

  return {
    conversationId: data.id,
    peerName: iAmMerchant ? (data.profiles?.full_name ?? "") : data.merchants.shop_name,
    peerKind: iAmMerchant ? "person" : "shop",
    myParticipantId: iAmMerchant ? data.merchants.profile_id : data.client_id,
    merchantId: data.merchants.id,
    merchantPublicId: data.merchants.id,
    iAmMerchant,
    blockedBy: data.blocked_by,
    isOpen: isOpen === true,
    iAmSuspended: myProfile?.isSuspended === true,
  };
}

/** Les messages d'un fil, dans l'ordre chronologique. */
export async function getMessages(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  myParticipantId: string,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at, product_id, products(title, price_gnf, status)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .returns<
      { id: string; sender_id: string; body: string; created_at: string; product_id: string | null; products: { title: string; price_gnf: number; status: Database["public"]["Enums"]["product_status"] } | null }[]
    >();
  if (error) throw error;

  return data.map((m) => ({
    id: m.id,
    mine: m.sender_id === myParticipantId,
    product:
      m.product_id && m.products
        ? { id: m.product_id, title: m.products.title, priceGnf: m.products.price_gnf, status: m.products.status }
        : null,
    body: m.body,
    sentAt: formatMessageTime(m.created_at),
  }));
}

/** Produits de la boutique d'un fil, pour l'écran « citer un produit » —
 * disponibles ou vendus (un produit vendu reste citable : la conversation
 * a pu commencer avant qu'il ne le devienne), jamais un brouillon. */
export async function getCitableProducts(supabase: SupabaseClient<Database>, merchantId: string) {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, price_gnf, status, product_images(storage_path, position)")
    .eq("merchant_id", merchantId)
    .in("status", ["active", "sold"])
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        title: string;
        price_gnf: number;
        status: Database["public"]["Enums"]["product_status"];
        product_images: { storage_path: string; position: number }[];
      }[]
    >();
  if (error) throw error;
  return data.map((p) => {
    const cover = [...p.product_images].sort((a, b) => a.position - b.position)[0];
    return {
      id: p.id,
      title: p.title,
      priceGnf: p.price_gnf,
      status: p.status,
      imageUrl: cover ? productImageUrl(cover.storage_path) : undefined,
    };
  });
}

/**
 * Messages non lus DANS UN ESPACE — client ou commerçant — pour le badge
 * de la barre d'onglets (décision 5 de docs/SPEC.md).
 *
 * Jamais global : un commerçant qui range sa boutique n'a pas à voir
 * clignoter les messages de son compte d'acheteur. Renvoie 0 sans rien
 * interroger quand l'espace n'a pas de profil — le catalogue public ne
 * doit rien coûter.
 */
export async function countUnreadMessages(
  supabase: SupabaseClient<Database>,
  space: Espace,
): Promise<number> {
  const profile = await getMyProfile(supabase, space === "merchant" ? "merchant" : "client");
  if (!profile) return 0;

  let conversationQuery = supabase.from("conversations").select("id");
  if (space === "merchant") {
    const merchant = await getMyMerchant(supabase);
    if (!merchant) return 0;
    conversationQuery = conversationQuery.eq("merchant_id", merchant.id);
  } else {
    conversationQuery = conversationQuery.eq("client_id", profile.id);
  }

  const { data: conversations, error: conversationsError } = await conversationQuery;
  if (conversationsError) throw conversationsError;
  if (conversations.length === 0) return 0;

  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", conversations.map((c) => c.id))
    .is("read_at", null)
    .neq("sender_id", profile.id);
  if (error) throw error;
  return count ?? 0;
}
