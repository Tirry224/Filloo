import { test } from "node:test";
import assert from "node:assert/strict";
import { erreurTelephone, estTelephone, lienWhatsApp, nettoyerTelephone } from "../src/lib/telephone.ts";
import { erreurNouveauMotDePasse, LONGUEUR_MIN_MOT_DE_PASSE } from "../src/lib/password.ts";
import { formatGnf, formatPhone } from "../src/lib/format.ts";

/**
 * Les règles de saisie, vérifiées CÔTÉ SERVEUR — donc les seules qui
 * garantissent quelque chose : les formulaires fonctionnent sans
 * JavaScript, et une requête forgée ne passe par aucun `pattern` HTML.
 *
 * Ce qui est figé ici n'est pas « le code fait ce qu'il fait », mais les
 * décisions : neuf chiffres commençant par 6, huit caractères minimum,
 * l'espace de bord d'un mot de passe qui compte, et l'espace insécable
 * ordinaire des montants.
 */

test("un numéro se normalise quelle que soit la façon de l'écrire", () => {
  /* Écrit de quatre façons par quatre personnes, c'est le MÊME numéro :
     sans cette normalisation à l'enregistrement, deux comptes du même
     commerçant ne se compareraient pas et `wa.me` recevrait n'importe
     quoi. */
  for (const ecriture of [
    "622334455",
    "622 33 44 55",
    "+224 622 33 44 55",
    "00224-622.33.44.55",
    "(622) 33-44.55",
  ]) {
    assert.equal(nettoyerTelephone(ecriture), "622334455", ecriture);
  }
});

test("seul un mobile guinéen à neuf chiffres commençant par 6 est accepté", () => {
  assert.equal(estTelephone("622334455"), true);
  assert.equal(estTelephone("+224 622 33 44 55"), true);

  // Huit chiffres, dix chiffres, mauvais premier chiffre, lettres.
  for (const faux of ["62233445", "6223344556", "522334455", "abcdefghi", ""]) {
    assert.equal(estTelephone(faux), false, faux);
  }
});

test("le téléphone du compte est obligatoire, le WhatsApp de la boutique non", () => {
  /* L'asymétrie est une décision : tous les commerçants n'ont pas de
     WhatsApp, et un numéro faux sous une boutique est pire qu'aucun
     numéro — le client croit avoir un recours. */
  assert.notEqual(erreurTelephone("", true), null);
  assert.equal(erreurTelephone("", false), null);
  assert.equal(erreurTelephone("622334455", true), null);
  assert.notEqual(erreurTelephone("123", false), null);
});

test("le message d'erreur nomme le champ concerné", () => {
  // « Entrez votre numéro de WhatsApp » et non « de téléphone » : sur un
  // écran qui porte les deux, un message générique ne dit pas lequel.
  assert.match(erreurTelephone("", true, "WhatsApp") ?? "", /WhatsApp/);
});

test("un mot de passe trop court est refusé AVANT la comparaison", () => {
  /* L'ordre compte : sinon « 1234 » tapé deux fois passe le premier
     contrôle et échoue au second, soit deux allers-retours pour un seul
     défaut. */
  const message = erreurNouveauMotDePasse("1234", "1234");
  assert.notEqual(message, null);
  assert.match(message ?? "", new RegExp(String(LONGUEUR_MIN_MOT_DE_PASSE)));
});

test("une espace de bord fait partie du mot de passe", () => {
  /* Pour Supabase, « motdepasse » et « motdepasse » suivi d'une espace
     sont deux mots de passe. Les rogner ici accepterait une paire qui
     n'ouvrira aucune session — et la personne serait enfermée dehors sans
     comprendre. */
  assert.notEqual(erreurNouveauMotDePasse("motdepasse ", "motdepasse"), null);
  assert.equal(erreurNouveauMotDePasse("motdepasse ", "motdepasse "), null);
});

test("un montant se lit sur un téléphone", () => {
  /* Intl sépare les milliers par une espace FINE insécable (U+202F), si
     étroite sur un écran de téléphone que « 450 000 » se lit « 450000 ».
     Ce test empêche la régression silencieuse : rien d'autre ne la
     signalerait. */
  const montant = formatGnf(450000);
  assert.equal(montant.includes(" "), false, "espace fine insécable réapparue");
  assert.equal(montant, "450 000 GNF");
  // Un prix à zéro est licite : un commerçant peut afficher « à négocier ».
  assert.equal(formatGnf(0), "0 GNF");
});

test("un numéro s'affiche groupé, et reste tel quel s'il ne fait pas neuf chiffres", () => {
  assert.equal(formatPhone("620451287"), "620 45 12 87");
  // Ne jamais découper ce qu'on ne reconnaît pas : un regroupement faux se
  // recopie faux.
  assert.equal(formatPhone("12345"), "12345");
});

test("LE LIEN WHATSAPP PORTE L'INDICATIF, sinon il ne mène nulle part", () => {
  /* Le défaut qui a vécu jusqu'au 2026-09-22 : les liens étaient bâtis à
     la main par `numero.replace(/\D/g, "")`, donc `wa.me/622334455` —
     neuf chiffres, sans indicatif. L'adresse est bien formée, elle ne
     désigne simplement aucun compte : le bouton existait et ouvrait un
     écran d'erreur. Rien ne pouvait le signaler, ni un type, ni un build,
     ni un test — parce qu'il n'y en avait pas. Celui-ci le fige. */
  assert.equal(lienWhatsApp("622334455"), "https://wa.me/224622334455");
});

test("le lien accepte toutes les écritures d'un même numéro", () => {
  // La base stocke neuf chiffres, mais un numéro saisi à la main depuis le
  // tableau de bord peut arriver sous n'importe quelle forme.
  for (const ecriture of ["622 33 44 55", "+224 622 33 44 55", "00224622334455"]) {
    assert.equal(lienWhatsApp(ecriture), "https://wa.me/224622334455", ecriture);
  }
});

test("un numéro absent ou fautif ne produit AUCUN lien", () => {
  /* Un bouton absent se comprend, un bouton mort se réessaie — c'est la
     règle déjà suivie par les écrans. Mieux vaut donc `null` qu'une
     adresse vers un numéro qui n'existe pas. */
  for (const inutilisable of [null, undefined, "", "12345", "522334455", "abc"]) {
    assert.equal(lienWhatsApp(inutilisable), null, String(inutilisable));
  }
});
