/**
 * Les liens écrits dans un message deviennent cliquables (demande du
 * porteur du projet, 2026-11-14 : un lien reçu dans la messagerie
 * restait du texte).
 *
 * Seuls `http://`, `https://` et `www.` sont reconnus. Un nom nu
 * (« filloo.net ») ne l'est pas : « 3.5 » ou « fin.Merci » deviendraient
 * des liens. Aucun autre protocole (`javascript:`, `data:`) ne passe :
 * le lien est reconstruit par `URL` et refusé s'il n'est pas http(s).
 */

export type Morceau = { texte: string; lien?: string };

const CANDIDAT = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
// Ponctuation de fin de phrase collée au lien : « voir https://x.com. »
const FIN_PARASITE = /[.,;:!?'»"]+$/;

function nettoyer(brut: string): string {
  let lien = brut.replace(FIN_PARASITE, "");
  // Une parenthèse fermante n'appartient au lien que s'il en a ouvert une.
  while (lien.endsWith(")") && (lien.match(/\(/g)?.length ?? 0) < (lien.match(/\)/g)?.length ?? 0)) {
    lien = lien.slice(0, -1).replace(FIN_PARASITE, "");
  }
  return lien;
}

function adresse(lien: string): string | null {
  try {
    const url = new URL(/^www\./i.test(lien) ? `https://${lien}` : lien);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function decouperLiens(texte: string): Morceau[] {
  const morceaux: Morceau[] = [];
  let curseur = 0;
  for (const trouve of texte.matchAll(CANDIDAT)) {
    const debut = trouve.index ?? 0;
    const lien = nettoyer(trouve[0]);
    const href = adresse(lien);
    if (!href) continue;
    if (debut > curseur) morceaux.push({ texte: texte.slice(curseur, debut) });
    morceaux.push({ texte: lien, lien: href });
    curseur = debut + lien.length;
  }
  if (curseur < texte.length) morceaux.push({ texte: texte.slice(curseur) });
  return morceaux;
}

/** Un lien vers Filloo s'ouvre dans l'onglet courant ; les autres dans
 * un nouvel onglet, pour ne pas perdre la conversation. */
export function lienInterne(href: string): boolean {
  const hote = new URL(href).hostname;
  return hote === "filloo.net" || hote.endsWith(".filloo.net");
}
