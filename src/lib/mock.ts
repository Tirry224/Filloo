import type { Message, Product, Thread } from "./types";

const aissatou: Product["merchant"] = {
  id: "m-aissatou",
  shopName: "Chez Aïssatou",
  city: "Conakry",
  addressHint: "Marché de Madina, allée 3",
  whatsappPhone: null,
  photoUrl: null,
};

const techKaloum: Product["merchant"] = {
  id: "m-tech-kaloum",
  shopName: "Tech Kaloum",
  city: "Conakry",
  addressHint: "Avenue de la République",
  whatsappPhone: null,
  photoUrl: null,
};

const fanta: Product["merchant"] = {
  id: "m-fanta",
  shopName: "Boutique Fanta",
  city: "Conakry",
  addressHint: "Marché de Matam",
  whatsappPhone: null,
  photoUrl: null,
};

function product(p: Omit<Product, "status" | "isFeatured" | "contactCount" | "imageUrls"> &
  Partial<Product>): Product {
  return { status: "active", isFeatured: false, contactCount: 0, imageUrls: [], ...p };
}

export const products: Product[] = [
  product({
    id: "p-riz",
    merchant: aissatou,
    category: "Alimentation & Boissons",
    title: "Sac de riz importé 50 kg",
    description:
      "Riz parfumé importé, sac de 50 kg. Qualité contrôlée. Retrait sur place au marché de Madina, livraison possible dans Conakry.",
    priceGnf: 450_000,
    isNegotiable: true,
    contactCount: 12,
  }),
  product({
    id: "p-tecno",
    merchant: techKaloum,
    category: "Électronique & Téléphones",
    title: "Téléphone Tecno Spark 10",
    description: "Neuf sous emballage, garantie 6 mois.",
    priceGnf: 850_000,
    isNegotiable: false,
    contactCount: 7,
  }),
  product({
    id: "p-huile",
    merchant: aissatou,
    category: "Alimentation & Boissons",
    title: "Bidon d'huile 20 L",
    description: null,
    priceGnf: 320_000,
    isNegotiable: false,
    status: "sold",
    contactCount: 4,
  }),
  product({
    id: "p-ventilateur",
    merchant: techKaloum,
    category: "Maison & Meubles",
    title: "Ventilateur sur pied",
    description: null,
    priceGnf: 275_000,
    isNegotiable: true,
    contactCount: 2,
  }),
  product({
    id: "p-sucre",
    merchant: aissatou,
    category: "Alimentation & Boissons",
    title: "Sucre en poudre 25 kg",
    description: null,
    priceGnf: 210_000,
    isNegotiable: false,
  }),
  product({
    id: "p-savon",
    merchant: aissatou,
    category: "Beauté & Cosmétiques",
    title: "Savon de Marseille × 12",
    description: null,
    priceGnf: 48_000,
    isNegotiable: false,
    status: "draft",
  }),
];

export const featuredProduct: Product = product({
  id: "p-pagne",
  merchant: fanta,
  category: "Vêtements & Chaussures",
  title: "Pagne wax 6 yards",
  description: null,
  priceGnf: 180_000,
  isNegotiable: true,
  isFeatured: true,
  contactCount: 21,
});

export function findProduct(id: string): Product | undefined {
  return [...products, featuredProduct].find((p) => p.id === id);
}

export const threads: Thread[] = [
  {
    id: "t-mariama",
    peerName: "Mariama Diallo",
    peerKind: "person",
    lastProductTitle: "Sac de riz importé 50 kg",
    lastMessage: "Et ce bidon d'huile ?",
    lastAt: "14:03",
    unreadCount: 2,
  },
  {
    id: "t-ibrahima",
    peerName: "Ibrahima Camara",
    peerKind: "person",
    lastProductTitle: "Bidon d'huile 20 L",
    lastMessage: "D'accord, je passe demain matin",
    lastAt: "11:47",
    unreadCount: 0,
  },
  {
    id: "t-fatoumata",
    peerName: "Fatoumata Bah",
    peerKind: "person",
    lastProductTitle: "Sucre en poudre 25 kg",
    lastMessage: "C'est votre dernier prix ?",
    lastAt: "Hier",
    unreadCount: 1,
  },
];

const riz = findProduct("p-riz")!;
const huile = findProduct("p-huile")!;

export const conversation: Message[] = [
  {
    id: "msg-1",
    mine: false,
    product: riz,
    body: "Bonjour, le sac de riz est-il disponible ?",
    sentAt: "09:12",
  },
  { id: "msg-2", mine: true, product: null, body: "Bonjour Mariama, oui il en reste 4 sacs.", sentAt: "09:20" },
  { id: "msg-3", mine: false, product: null, body: "Et vous livrez à Ratoma ?", sentAt: "09:22" },
  { id: "msg-4", mine: true, product: null, body: "Oui, 30 000 GNF de livraison.", sentAt: "09:25" },
  { id: "msg-5", mine: false, product: huile, body: "Et ce bidon d'huile ?", sentAt: "14:03" },
];

export const conversationReportReasons = [
  "Insultes ou menaces",
  "Tentative d'arnaque",
  "Messages répétés non désirés",
  "Demande d'argent à l'avance",
  "Autre",
];

export const reportReasons = [
  "Produit interdit ou illégal",
  "Photo trompeuse",
  "Prix ou description mensongers",
  "Contrefaçon",
  "Autre",
];
