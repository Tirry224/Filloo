/**
 * Types du domaine, lus par tous les écrans.
 *
 * Ils coexistent avec le schéma Supabase au lieu de le refléter : la base
 * est en snake_case (`price_gnf`), ces types en camelCase (`priceGnf`).
 * `src/lib/database.types.ts` (généré) et `src/lib/data/` (la traduction)
 * sont les seuls endroits qui connaissent le schéma réel.
 */

export type ProductStatus = "draft" | "active" | "sold" | "hidden";
export type MerchantStatus = "pending" | "approved" | "rejected";
export type UserRole = "client" | "merchant";

export type Merchant = {
  id: string;
  shopName: string;
  description: string | null;
  city: string;
  addressHint: string | null;
  whatsappPhone: string | null;
  status: MerchantStatus;
  /** Rempli par l'administrateur quand `status` vaut `"rejected"`. */
  rejectionReason: string | null;
};

export type Product = {
  id: string;
  merchant: Pick<Merchant, "id" | "shopName" | "city" | "addressHint" | "whatsappPhone">;
  category: string;
  title: string;
  description: string | null;
  priceGnf: number;
  isNegotiable: boolean;
  status: ProductStatus;
  isFeatured: boolean;
  contactCount: number;
  /** Adresses publiques des photos, dans l'ordre d'affichage. */
  imageUrls: string[];
};

export type Message = {
  id: string;
  /** `true` si c'est l'utilisateur courant qui a écrit. */
  mine: boolean;
  /** Produit cité par ce message. Le premier message d'un fil en a toujours un. */
  product: Pick<Product, "id" | "title" | "priceGnf" | "status"> | null;
  body: string;
  sentAt: string;
};

export type Thread = {
  id: string;
  /** Nom affiché : la boutique côté client, la personne côté commerçant. */
  peerName: string;
  peerKind: "shop" | "person";
  lastProductTitle: string;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
};
