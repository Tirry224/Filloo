/**
 * Une page de liste ne se retire de Google que si elle est VRAIMENT
 * filtrée. L'ancienne règle (« au moins un paramètre ») retirait aussi
 * l'accueil arrivé par `?fbclid=…` (un lien partagé sur Facebook),
 * `?utm_source=…` ou un lien de partage Vercel : Google lisait alors
 * `noindex` ET `canonical="/"` sur la même page — deux ordres contraires,
 * constaté en production le 2026-11-08.
 *
 * On ne compte donc que les paramètres qui changent ce qu'affiche la page,
 * et seulement s'ils portent une valeur.
 */
export function estFiltree(
  params: Record<string, string | string[] | undefined>,
  cles: readonly string[],
): boolean {
  return cles.some((cle) => {
    const v = params[cle];
    const valeurs = Array.isArray(v) ? v : [v];
    return valeurs.some((x) => typeof x === "string" && x.trim() !== "");
  });
}

/** Le JSON-LD d'une page, prêt pour `dangerouslySetInnerHTML` : le `<`
 * échappé empêche un texte saisi (titre, nom de boutique) de fermer la
 * balise `<script>`. */
export function jsonLd(donnees: unknown): string {
  return JSON.stringify(donnees).replace(/</g, "\\u003c");
}
