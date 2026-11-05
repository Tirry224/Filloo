/**
 * Ce qui n'est PAS une personne, pour que les mesures (0024) ne comptent
 * que des gens. Constaté le 2026-11-05 : 99 % des « recherches » n'avaient
 * aucun mot (un robot qui parcourt les catégories), jusqu'à 360 par heure
 * en pleine nuit, contre 118 fiches produit vues en six semaines.
 *
 * L'agent utilisateur est LU pour décider, jamais ENREGISTRÉ : la table des
 * mesures n'en porte aucun, et la politique de confidentialité le promet.
 *
 * Un robot qui se fait passer pour un navigateur passe : ceci écarte les
 * robots honnêtes (moteurs de recherche, aperçus de liens WhatsApp ou
 * Facebook, outils de test) et les préchargements, pas un adversaire.
 */

/** Les signatures des robots courants. Une seule expression, insensible à la casse.
 *  `(?<!cu)` : les téléphones Cubot (« CUBOT X30 ») sont des personnes. */
const SIGNATURES =
  /(?<!cu)bot\b|(?<!cu)bot\/|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|twitterbot|linkedin|embedly|preview|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|vercel|curl|wget|python|axios|node-fetch|undici|go-http|java\/|okhttp|libwww|httpclient|scrapy|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|perplexity|applebot|yandex|baidu|duckduck|bingpreview|google-inspectiontool|googleother/i;

export type EntetesRequete = { get(nom: string): string | null };

/** Vrai si la requête ne vient pas d'une personne qui regarde la page. */
export function nEstPasUnePersonne(entetes: EntetesRequete): boolean {
  // Un préchargement (survol d'un lien, `<Link>`) n'est pas une page vue.
  if (entetes.get("next-router-prefetch") || entetes.get("purpose") === "prefetch") return true;
  if ((entetes.get("sec-purpose") ?? "").includes("prefetch")) return true;
  const agent = entetes.get("user-agent")?.trim() ?? "";
  // Un navigateur annonce toujours qui il est.
  if (!agent) return true;
  return SIGNATURES.test(agent);
}
