/**
 * Vérifie que les deux espaces de Makiti — client et commerçant — restent
 * séparés.
 *
 *     node scripts/verifier-espaces.mjs
 *
 * Ce script protège un PARCOURS, pas une donnée : le RLS couvre déjà les
 * données et ne dit rien de la navigation. Ni `tsc` ni `next build` ne
 * signalent qu'un écran client importe la barre du commerçant. Sort en
 * code 1 à la première règle violée.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const RACINE = resolve(import.meta.dirname, "..");
const APP = join(RACINE, "src/app");
const SRC = join(RACINE, "src");

function fichiers(dir, ext = [".tsx", ".ts"]) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) out.push(...fichiers(chemin, ext));
    else if (ext.some((e) => nom.endsWith(e))) out.push(chemin);
  }
  return out;
}

const court = (f) => relative(RACINE, f);
const lire = (f) => readFileSync(f, "utf8");

/**
 * Le texte hors commentaires : une règle qui se déclenche sur une
 * explication est une règle qu'on finit par désactiver.
 *
 * Les commentaires sont BLANCHIS et non supprimés, pour que la ligne N du
 * résultat reste la ligne N du fichier.
 */
function code(source) {
  const blanchir = (m) => m.replace(/[^\n]/g, " ");
  return source.replace(/\/\*[\s\S]*?\*\//g, blanchir).replace(/^\s*\/\/.*$/gm, blanchir);
}

const echecs = [];
const rate = (regle, ou, detail) => echecs.push({ regle, ou, detail });

const espaceClient = join(APP, "(client)");
const espaceVendeur = join(APP, "(vendeur)");

// ---------------------------------------------------------------------
// 1. Les deux espaces existent, et le commerçant est gardé à sa racine.
// ---------------------------------------------------------------------
// Un layout est le seul point de passage qu'une route enfant ne peut pas
// contourner. Sans cette garde, tout le reste de ce fichier est décoratif.
const gardeVendeur = join(espaceVendeur, "layout.tsx");
if (!existsSync(gardeVendeur)) {
  rate("garde", court(gardeVendeur), "le layout de garde de l'espace commerçant a disparu");
} else if (!code(lire(gardeVendeur)).includes("requireMerchantSpace")) {
  rate("garde", court(gardeVendeur), "le layout ne fait plus appel à requireMerchantSpace");
}

// ---------------------------------------------------------------------
// 2. Aucun espace n'importe la barre de navigation de l'autre.
// ---------------------------------------------------------------------
for (const [espace, dossier, interdit] of [
  ["client", espaceClient, "MerchantNav"],
  ["commerçant", espaceVendeur, "ClientNav"],
]) {
  for (const f of fichiers(dossier)) {
    if (code(lire(f)).includes(interdit)) {
      rate("navigation", court(f), `un écran de l'espace ${espace} référence ${interdit}`);
    }
  }
}

// ---------------------------------------------------------------------
// 3. Seuls les layouts `(onglets)` rendent une barre de navigation.
// ---------------------------------------------------------------------
// Tant qu'un écran rend sa propre barre, il peut se tromper de barre.
// La règle se vérifie sur le rendu, pas sur l'intention.
for (const f of fichiers(APP)) {
  const estLayoutOnglets = f.endsWith(join("(onglets)", "layout.tsx"));
  if (estLayoutOnglets) continue;
  const c = code(lire(f));
  for (const barre of ["<ClientNav", "<MerchantNav"]) {
    if (c.includes(barre)) {
      rate("navigation", court(f), `${barre.slice(1)} est rendue par un écran au lieu de son layout`);
    }
  }
}

// ---------------------------------------------------------------------
// 4. `?vue=` est mort, et doit le rester.
// ---------------------------------------------------------------------
// L'espace actif se lit dans le CHEMIN. Un paramètre qui rejouerait ce
// rôle ferait rendre deux écrans différents à une même route.
for (const f of fichiers(SRC)) {
  if (code(lire(f)).includes("vue=")) {
    rate("espace", court(f), "`?vue=` est de retour : l'espace redevient une query string");
  }
}

// ---------------------------------------------------------------------
// 5. La messagerie du commerçant vit sous `/vendeur`.
// ---------------------------------------------------------------------
// Les composants de fil servent les deux espaces : ils reçoivent leur
// racine (`messagesBase`, `basePath`) et n'écrivent aucun chemin en dur,
// sans quoi un commerçant ressort côté client au premier lien.
for (const f of fichiers(join(SRC, "components/chat"))) {
  const c = code(lire(f));
  if (/["'`]\/messages\//.test(c)) {
    rate("messagerie", court(f), "chemin `/messages/...` écrit en dur dans un composant partagé");
  }
}

// ---------------------------------------------------------------------
// 6. Un écran client n'envoie personne dans l'espace commerçant.
// ---------------------------------------------------------------------
// Une seule exception : `SwitchSpaceCard`, un geste demandé par la
// personne et non une redirection subie.
for (const f of fichiers(espaceClient)) {
  const source = lire(f);
  const c = code(source);
  if (!/["'`]\/vendeur/.test(c)) continue;
  const lignes = c.split("\n");
  // La dérogation vit dans un commentaire : on la cherche donc dans le
  // texte d'origine. Même découpage, mêmes indices.
  const lignesSource = source.split("\n");
  for (const [i, ligne] of lignes.entries()) {
    if (!/["'`]\/vendeur/.test(ligne)) continue;
    /* On remonte jusqu'au bloc englobant plutôt qu'à un nombre fixe de
       lignes : une fenêtre fixe casse au premier élément un peu long. La
       ligne vide est la frontière que le code se donne lui-même. */
    let debut = i;
    while (debut > 0 && lignesSource[debut - 1].trim() !== "" && i - debut < 40) debut--;
    const contexte = lignesSource.slice(debut, i + 2).join("\n");
    if (contexte.includes("SwitchSpaceCard")) continue;
    /* Dérogation explicite, écrite à côté du lien avec sa raison : une
       liste d'exceptions rangée ici serait invisible depuis le code
       qu'elle autorise. */
    if (contexte.includes("espaces:autorise")) continue;
    rate("espace", `${court(f)}:${i + 1}`, `lien vers l'espace commerçant : ${ligne.trim()}`);
  }
}

// ---------------------------------------------------------------------
// 7. Un composant de fil qui reçoit `espace` porte sa garde.
// ---------------------------------------------------------------------
// Ces composants sont montés par deux routes, une par espace : le chemin
// emprunté est une affirmation que seul `getThreadContext` peut confirmer.
// Sans confrontation, un commerçant qui ouvre l'adresse client obtient
// l'écran habillé en client.
for (const f of fichiers(join(SRC, "components/chat"))) {
  const c = code(lire(f));
  if (!/\bespace: Espace\b/.test(c)) continue;
  if (!c.includes("espaceReel")) {
    rate("messagerie", court(f), "reçoit `espace` mais ne vérifie pas qu'il correspond au côté réel du fil");
  }
}

// ---------------------------------------------------------------------
// 8. Les mécanismes remplacés ne reviennent pas.
// ---------------------------------------------------------------------
for (const mort of ["src/components/ui/BottomNav.tsx", "src/lib/space.ts"]) {
  if (existsSync(join(RACINE, mort))) {
    rate("espace", mort, "un mécanisme remplacé est réapparu (barre unique à prop, ou messagesHref)");
  }
}

// ---------------------------------------------------------------------

const verifiees = fichiers(APP).length + fichiers(join(SRC, "components")).length;

if (echecs.length === 0) {
  console.log(`✓ ${verifiees} fichiers vérifiés, les deux espaces restent séparés.`);
  process.exit(0);
}

console.error(`✗ ${echecs.length} mélange(s) d'espaces :\n`);
for (const { regle, ou, detail } of echecs) {
  console.error(`  [${regle}] ${ou}`);
  console.error(`      ${detail}`);
}
console.error(
  "\nLa règle : un client et un commerçant ne partagent jamais un écran, une\nbarre de navigation ou une route. Ce qui se partage — un fil de\ndiscussion se dessine pareil des deux côtés — se partage en COMPOSANT,\nmonté par deux routes distinctes qui imposent chacune leur espace.",
);
process.exit(1);
