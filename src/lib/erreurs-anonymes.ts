/**
 * Ce qui reste d'une requête avant qu'une erreur parte chez Sentry.
 *
 * `sendDefaultPii: false` NE SUFFIT PAS : constaté le 2026-10-14 avec
 * `@sentry/nextjs` 10.76, `captureRequestError` joint quand même les
 * en-têtes `cookie` et `authorization`, donc la session Supabase de la
 * personne — de quoi se connecter à sa place.
 *
 * D'où une liste d'en-têtes AUTORISÉS plutôt qu'interdits : un en-tête
 * ajouté demain par Vercel (`x-vercel-ip-city`, `x-forwarded-for`…) reste
 * dehors sans qu'on y pense. L'adresse perd sa chaîne de requête, qui
 * porte parfois un jeton (`/auth/confirm?token_hash=…`) — y compris
 * la copie qu'en fait le SDK dans `contexts.nextjs.request_path`.
 *
 * Les « fils d'Ariane » (`breadcrumbs`) sont retirés en entier : le SDK y range
 * chaque appel sortant avec sa requête (`?telephone=eq.…` vers Supabase)
 * et chaque `console.*` du serveur. Seule la pile de l'erreur reste.
 *
 * Ce que ce filtre NE retire PAS : le texte de l'erreur elle-même (un
 * message Postgres peut citer une valeur). L'enlever ôterait le diagnostic.
 */

const EN_TETES_GARDES = new Set(["host", "user-agent", "content-type", "accept-language"]);

type Requete = {
  url?: string;
  headers?: Record<string, string>;
  cookies?: unknown;
  query_string?: unknown;
  data?: unknown;
  env?: unknown;
};

type Evenement = {
  request?: Requete;
  user?: unknown;
  breadcrumbs?: unknown;
  contexts?: Record<string, Record<string, unknown> | undefined>;
};

const sansRequete = (adresse: string) => adresse.split("?")[0];

export function anonymiser<E extends Evenement>(evenement: E): E {
  delete evenement.user;
  delete evenement.breadcrumbs;
  const nextjs = evenement.contexts?.nextjs;
  if (nextjs && typeof nextjs.request_path === "string") {
    nextjs.request_path = sansRequete(nextjs.request_path);
  }
  const r = evenement.request;
  if (!r) return evenement;

  if (r.headers) {
    r.headers = Object.fromEntries(
      Object.entries(r.headers).filter(([nom]) => EN_TETES_GARDES.has(nom.toLowerCase())),
    );
  }
  if (r.url) r.url = sansRequete(r.url);
  delete r.cookies;
  delete r.query_string;
  delete r.data;
  delete r.env;
  return evenement;
}
