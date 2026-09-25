/**
 * L'adresse où reprendre après une connexion. Elle vient de l'URL, donc de
 * n'importe qui : sans contrôle, `?next=https://faux-filloo.gn` est une
 * redirection ouverte vers un site d'hameçonnage.
 *
 * Comparer des préfixes ne suffit pas — `/⇥/faux-filloo.gn` passerait, car
 * les navigateurs effacent tabulations et sauts de ligne AVANT d'analyser
 * l'adresse. Il faut donc l'analyser comme le fera celui qui la suivra :
 * pas de caractère de contrôle, et résolue contre une origine bidon, elle
 * doit rester sur cette origine.
 *
 * `.invalid` est réservé par la RFC 2606 : rien n'est joint ici.
 */
const ORIGINE_DE_TEST = "http://filloo.invalid";

/** Tabulation, retour chariot, saut de ligne et le reste des caractères de
 * contrôle : chacun fait dire à l'adresse autre chose qu'elle ne montre. */
const CARACTERE_DE_CONTROLE = /[\u0000-\u001F\u007F]/;

export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  if (!next.startsWith("/")) return null;
  if (CARACTERE_DE_CONTROLE.test(next)) return null;

  let resolue: URL;
  try {
    resolue = new URL(next, ORIGINE_DE_TEST);
  } catch {
    return null;
  }
  if (resolue.origin !== ORIGINE_DE_TEST) return null;

  // La forme résolue, pas la chaîne d'origine : ce qui sort d'ici est ce
  // que le navigateur aurait compris, non un texte encore à interpréter.
  return `${resolue.pathname}${resolue.search}${resolue.hash}`;
}

/** La première valeur d'un paramètre d'URL. Next rend un TABLEAU quand le
 * paramètre est répété (`?q=riz&q=huile`), ce que le type `string` des
 * pages ne dit pas. */
export function premier(valeur: string | string[] | undefined): string | undefined {
  return Array.isArray(valeur) ? valeur[0] : valeur;
}
