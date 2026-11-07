/**
 * Une adresse d'abonnement aux notifications du navigateur est-elle bien
 * celle d'un service de push connu ?
 *
 * Le navigateur la fournit, mais rien n'empêche quelqu'un d'en envoyer une
 * autre à `/api/push/abonnement` : le serveur ferait alors une requête
 * POST, signée, vers l'adresse de son choix à chaque message reçu (audit
 * du 2026-11-07). Seuls les services des navigateurs sont acceptés.
 *
 * Un navigateur dont le service manquerait ici ne peut plus s'abonner :
 * l'ajouter à la liste, jamais retirer la vérification.
 */
const HOTES_EXACTS = new Set([
  "fcm.googleapis.com", // Chrome, Android, Opera, Samsung Internet, Brave
  "android.googleapis.com", // ancien nom du même service
  "updates.push.services.mozilla.com", // Firefox
]);

const SUFFIXES = [
  ".push.apple.com", // Safari (web.push.apple.com)
  ".notify.windows.com", // Edge sous Windows (wns2-xxx.notify.windows.com)
];

export function estAdressePush(valeur: unknown): valeur is string {
  if (typeof valeur !== "string" || valeur.length > 1000) return false;
  let adresse: URL;
  try {
    adresse = new URL(valeur);
  } catch {
    return false;
  }
  if (adresse.protocol !== "https:" || adresse.port !== "" || adresse.username || adresse.password) return false;
  const hote = adresse.hostname.toLowerCase();
  return HOTES_EXACTS.has(hote) || SUFFIXES.some((suffixe) => hote.endsWith(suffixe));
}
