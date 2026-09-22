/**
 * L'adresse publique de Makiti — un SEUL endroit qui la décide.
 *
 * Elle sert partout où un lien doit survivre à la sortie de
 * l'application : un email, une notification push, une balise Open Graph,
 * un sitemap. Un lien relatif y est mort — une boîte mail ne sait pas
 * contre quoi le résoudre.
 *
 * POURQUOI CE FICHIER EXISTE. Le dépôt construisait cette adresse de deux
 * façons : `NEXT_PUBLIC_SITE_URL` dans `notifications.ts`, `push.ts` et
 * `notifications-decisions.ts`, mais l'en-tête `Host` dans
 * `requestPasswordResetAction`. Deux façons de répondre à la même
 * question, c'est une de trop : celle qui n'est pas maintenue finit par
 * répondre autre chose. `Host` est en plus une valeur que le CLIENT
 * envoie — non exploitable ici, Supabase filtrant `redirectTo`, mais la
 * protection vivait alors dans un réglage de tableau de bord, hors du
 * dépôt et hors de vue.
 *
 * LES TROIS SOURCES, dans cet ordre :
 *
 * 1. `NEXT_PUBLIC_SITE_URL`, posée à la main. Elle gagne toujours : c'est
 *    la seule qui connaisse un domaine propre le jour où Makiti en prend
 *    un.
 * 2. `VERCEL_PROJECT_PRODUCTION_URL`, que Vercel pose SEUL sur chaque
 *    déploiement et qui porte le domaine de production du projet. C'est
 *    le filet qui manquait : sans lui, oublier la variable numéro 1 sur
 *    le tableau de bord éteignait TOUS les emails en silence — un
 *    `console.error` que personne ne lit, et un commerçant validé qui
 *    n'apprend jamais qu'il l'est. Cette panne a réellement eu lieu.
 * 3. Rien. L'appelant décide alors quoi faire : `notifications.ts`
 *    renonce à l'envoi, le sitemap se tait. On ne devine pas un domaine.
 *
 * Volontairement PAS de repli sur `Host` ni sur `VERCEL_URL` : le premier
 * vient du client, le second change à chaque déploiement, donc un lien
 * bâti dessus meurt au déploiement suivant — exactement ce qu'un email
 * ne pardonne pas.
 */

/** Sans barre oblique finale : tous les appelants concatènent un chemin
 * qui commence déjà par `/`, et `https://site.gn//produit/x` est une
 * adresse différente pour un moteur de recherche. */
function sansBarreFinale(valeur: string): string {
  return valeur.replace(/\/+$/, "");
}

export function siteUrl(): string | null {
  const explicite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicite) return sansBarreFinale(explicite);

  /* Vercel la donne sans protocole (`makiti.vercel.app`), et toujours en
     HTTPS côté production. */
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return sansBarreFinale(vercel.startsWith("http") ? vercel : `https://${vercel}`);

  return null;
}

/**
 * Même adresse, mais l'appelant accepte de se rabattre sur le serveur de
 * développement. Réservé à ce qui DOIT produire une URL absolue même hors
 * ligne — les liens d'authentification, qu'on doit pouvoir suivre en
 * développement sans poser de variable.
 */
export function siteUrlOuLocalhost(port = 3000): string {
  return siteUrl() ?? `http://localhost:${port}`;
}
