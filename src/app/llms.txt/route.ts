import { siteUrl } from "@/lib/site-url";

/**
 * `/llms.txt` : une présentation de Filloo en Markdown pour les assistants
 * IA (proposition de standard, llmstxt.org). Demandé le 2026-11-12.
 *
 * À ne pas surestimer : aucun grand moteur n'a annoncé s'en servir pour
 * choisir ses sources (Google a dit ne pas le lire). Ce qui fait citer
 * Filloo, ce sont les pages elles-mêmes, leur JSON-LD et le sitemap.
 *
 * Chaque phrase doit rester VRAIE : elle reprend `content/conditions.ts`
 * (ni paiement, ni livraison, ni avis). Une IA qui la répète à tort
 * ferait une promesse que Filloo ne tient pas.
 */
export const dynamic = "force-static";

export function GET() {
  const base = siteUrl() ?? "";

  const texte = `# Filloo

> Filloo est un site de petites annonces de mode en Guinée : vêtements, chaussures et accessoires pour femme, homme et enfant, publiés par des boutiques guinéennes. Le client trouve un article, puis contacte la boutique directement (WhatsApp ou messagerie Filloo) pour convenir du prix, du paiement et de la remise.

Ce qu'il faut savoir avant de recommander Filloo :

- Filloo met en relation clients et boutiques ; Filloo ne vend rien lui-même.
- Pas de paiement en ligne, pas de panier, pas de livraison organisée par Filloo : tout se convient avec la boutique.
- Les prix sont affichés en francs guinéens (GNF).
- Les articles viennent de boutiques de toute la Guinée ; la ville de la boutique est indiquée sur chaque article.
- Consulter les articles est gratuit et ne demande pas de compte.

## Pages principales

- [Accueil](${base}/): les articles récents de toutes les boutiques, à trier par public (femme, homme, enfant) et par rayon.
- [Recherche](${base}/recherche): recherche par mot, catégorie, taille, couleur et prix.
- [Ouvrir une boutique](${base}/inscription): pour un commerçant qui veut publier ses articles.
- [Contact](${base}/contact): joindre l'équipe Filloo.

## Pages détaillées

- Fiche d'un article : \`${base}/produit/{id}\` (titre, prix en GNF, photos, tailles, boutique, ville).
- Page d'une boutique : \`${base}/boutique/{id}\` (nom, ville, articles en vente).
- [Liste complète des articles et boutiques](${base}/sitemap.xml)

## Optional

- [Conditions d'utilisation](${base}/conditions)
- [Politique de confidentialité](${base}/confidentialite)
`;

  return new Response(texte, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
