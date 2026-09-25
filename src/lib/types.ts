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
  /** Null : pas de photo, l'icône par défaut s'affiche. */
  photoUrl: string | null;
  status: MerchantStatus;
  rejectionReason: string | null;
};

export type Product = {
  id: string;
  merchant: Pick<Merchant, "id" | "shopName" | "city" | "addressHint" | "whatsappPhone" | "photoUrl">;
  category: string;
  title: string;
  description: string | null;
  priceGnf: number;
  isNegotiable: boolean;
  status: ProductStatus;
  isFeatured: boolean;
  contactCount: number;
  imageUrls: string[];
};

export type Message = {
  id: string;
  mine: boolean;
  product: (Pick<Product, "id" | "title" | "priceGnf" | "status"> & { imageUrl?: string }) | null;
  body: string;
  sentAt: string;
};

export type Thread = {
  id: string;
  peerName: string;
  peerKind: "shop" | "person";
  /** La photo de la boutique en face ; jamais celle d'une personne,
   * qui n'en a pas. */
  peerPhotoUrl?: string;
  lastProductTitle: string;
  lastProductImageUrl?: string;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
};
