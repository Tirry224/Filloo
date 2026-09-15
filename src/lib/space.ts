/**
 * L'espace actif — client ou commerçant — et l'adresse de la messagerie
 * qui lui correspond.
 *
 * Makiti sert DEUX espaces derrière une seule connexion (docs/SPEC.md,
 * décision 8), et `/messages` est le seul écran partagé par les deux :
 * `?vue=commercant` est ce qui les distingue quand la connexion possède
 * ses deux profils liés. Ce paramètre était écrit à la main dans
 * `BottomNav` et nulle part ailleurs — d'où un commerçant renvoyé dans sa
 * boîte de CLIENT dès qu'il passait par un autre lien (la carte « Mes
 * messages » de sa boutique, le retour depuis un fil).
 *
 * Une chaîne écrite à un seul endroit ne se désynchronise pas : tout lien
 * vers la messagerie passe désormais par cette fonction.
 */
export type Space = "client" | "merchant";

export function messagesHref(space: Space): string {
  return space === "merchant" ? "/messages?vue=commercant" : "/messages";
}
