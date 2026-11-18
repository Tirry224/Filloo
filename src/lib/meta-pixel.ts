/**
 * Meta Pixel (publicités Facebook / Instagram), décision du porteur du
 * projet le 2026-11-18 : mesurer les inscriptions venues d'une pub.
 *
 * Sans `NEXT_PUBLIC_META_PIXEL_ID` (réglé sur Vercel), rien n'est chargé
 * et ces fonctions ne font rien : pas d'identifiant deviné.
 */
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || null;

/** Déposé par les actions serveur qui CRÉENT un compte, puis lu une seule
 * fois côté navigateur. Il fait le pont parce que ces actions finissent
 * par une redirection : le code du navigateur ne voit que la page
 * d'arrivée, pas l'inscription elle-même. Pas `httpOnly` : c'est le
 * navigateur qui doit le lire. */
export const COOKIE_INSCRIPTION = "filloo_inscription";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push?: Fbq;
  loaded: boolean;
  version: string;
};
type FenetreMeta = Window & { fbq?: Fbq; _fbq?: Fbq };

/**
 * L'amorce officielle de Meta, réécrite lisiblement : une file d'attente
 * `fbq` existe AVANT que `fbevents.js` arrive, donc un événement envoyé
 * tout de suite n'est pas perdu — il part quand le script est chargé.
 * Idempotente : un second appel ne recharge rien.
 */
export function initialiserPixel() {
  if (!META_PIXEL_ID || typeof window === "undefined") return;
  const w = window as FenetreMeta;
  if (w.fbq) return;
  const f = function (...args: unknown[]) {
    if (f.callMethod) f.callMethod(...args);
    else f.queue.push(args);
  } as Fbq;
  f.push = f;
  f.loaded = true;
  f.version = "2.0";
  f.queue = [];
  w.fbq = f;
  w._fbq = f;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  f("init", META_PIXEL_ID);
}

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  return (window as FenetreMeta).fbq ?? null;
}

export function pixelPageVue() {
  fbq()?.("track", "PageView");
}

/**
 * Envoie `CompleteRegistration` si une inscription vient d'avoir lieu
 * dans ce navigateur, et efface le témoin pour ne pas la compter deux
 * fois. Le rôle part en `content_name`, pour séparer dans le gestionnaire
 * de publicités les acheteurs des vendeurs.
 */
export function pixelInscriptionEnAttente() {
  const trouve = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_INSCRIPTION}=`));
  if (!trouve) return;
  document.cookie = `${COOKIE_INSCRIPTION}=; Max-Age=0; Path=/`;
  const role = trouve.slice(COOKIE_INSCRIPTION.length + 1);
  fbq()?.("track", "CompleteRegistration", {
    content_name: role === "merchant" ? "vendeur" : "acheteur",
  });
}
