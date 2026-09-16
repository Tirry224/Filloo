/**
 * Vérifie que les deux espaces de Makiti — client et commerçant — restent
 * séparés.
 *
 * POURQUOI CE SCRIPT EXISTE
 * La séparation des espaces est une règle d'ARCHITECTURE, et une règle
 * d'architecture ne se défend pas toute seule. Ni `tsc`, ni `next build`,
 * ni aucun test de sécurité ne signalent qu'un écran client vient
 * d'importer la barre du commerçant, ou qu'un lien en dur ramène un
 * commerçant dans le fil d'achat. Le code compile, la page s'affiche, et
 * les deux espaces se remélangent — exactement comme avant la
 * réorganisation, où la barre d'onglets se choisissait par une prop dont
 * la valeur par défaut était « client ».
 *
 * Ce que ce script protège n'est donc pas une donnée, c'est un PARCOURS.
 * Le RLS et les tests de sécurité couvrent déjà les données ; ils sont
 * parfaitement silencieux sur la navigation.
 *
 *     node scripts/verifier-espaces.mjs
 *
 * Il sort en code 1 à la première règle violée, pour être branché sur
 * l'intégration continue.
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
 * Le texte hors commentaires : une règle qui se déclenche sur un
 * commentaire d'explication est une règle qu'on finit par désactiver.
 *
 * Les commentaires sont BLANCHIS, pas supprimés : chaque saut de ligne
 * est conservé, donc la ligne N du résultat reste la ligne N du fichier.
 * La première version les retirait — les numéros de ligne rapportés
 * étaient alors faux, et surtout la dérogation `espaces:autorise`, qui
 * vit dans un commentaire, avait disparu au moment où on la cherchait.
 * Une règle et son échappatoire doivent regarder le même texte.
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
// Cette garde est LA raison d'être du groupe `(vendeur)` : un layout est
// le seul point de passage qu'une route enfant ne peut pas contourner.
// Si elle disparaît, tout le reste de ce fichier devient décoratif.
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
// C'est la correction structurelle : tant qu'un ÉCRAN rend sa propre
// barre, il peut se tromper de barre. S'il ne la rend pas, il ne peut
// plus. La règle se vérifie donc sur le rendu, pas sur l'intention.
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
// L'espace actif se lit désormais dans le CHEMIN. Un paramètre qui
// rejouerait ce rôle ramènerait l'ambiguïté que toute cette organisation
// sert à supprimer : une même route rendant deux écrans différents.
for (const f of fichiers(SRC)) {
  if (code(lire(f)).includes("vue=")) {
    rate("espace", court(f), "`?vue=` est de retour : l'espace redevient une query string");
  }
}

// ---------------------------------------------------------------------
// 5. La messagerie du commerçant vit sous `/vendeur`.
// ---------------------------------------------------------------------
// Les composants de fil servent les deux espaces : ils doivent recevoir
// leur racine (`messagesBase`, `basePath`) et n'écrire aucun chemin en
// dur, sans quoi un commerçant ressort dans l'espace client au premier
// lien — c'est le défaut exact qu'on vient de corriger.
for (const f of fichiers(join(SRC, "components/chat"))) {
  const c = code(lire(f));
  if (/["'`]\/messages\//.test(c)) {
    rate("messagerie", court(f), "chemin `/messages/...` écrit en dur dans un composant partagé");
  }
}

// ---------------------------------------------------------------------
// 6. Un écran client n'envoie personne dans l'espace commerçant.
// ---------------------------------------------------------------------
// Une seule exception, et elle est explicite : la carte de bascule entre
// comptes liés (`SwitchSpaceCard`), qui est un geste DEMANDÉ par la
// personne, pas une redirection subie. Tout autre lien vers `/vendeur`
// depuis un écran client est un mélange d'espaces.
for (const f of fichiers(espaceClient)) {
  const source = lire(f);
  const c = code(source);
  if (!/["'`]\/vendeur/.test(c)) continue;
  const lignes = c.split("\n");
  // La dérogation se cherche dans le texte D'ORIGINE, commentaires
  // compris — c'est là qu'elle est écrite. Même découpage, mêmes indices.
  const lignesSource = source.split("\n");
  for (const [i, ligne] of lignes.entries()) {
    if (!/["'`]\/vendeur/.test(ligne)) continue;
    /* On remonte jusqu'au BLOC englobant — le commentaire ou l'élément
       JSX dans lequel ce lien est écrit — plutôt qu'un nombre fixe de
       lignes. Une fenêtre fixe se règle par tâtonnement et se casse au
       premier élément un peu long : `<SwitchSpaceCard>` occupait déjà
       onze lignes. La ligne vide est la frontière que le code se donne
       lui-même, et c'est celle qu'un relecteur utilise aussi. */
    let debut = i;
    while (debut > 0 && lignesSource[debut - 1].trim() !== "" && i - debut < 40) debut--;
    const contexte = lignesSource.slice(debut, i + 2).join("\n");
    if (contexte.includes("SwitchSpaceCard")) continue;
    /* Dérogation explicite. Elle doit être ÉCRITE à côté du lien, avec sa
       raison : une liste d'exceptions rangée dans ce script serait
       invisible depuis le code qu'elle autorise, et personne ne la
       relirait en modifiant l'écran. Ici, qui touche au lien lit la
       justification, et qui ajoute une dérogation doit l'assumer dans le
       fichier concerné — pas dans le vérificateur. */
    if (contexte.includes("espaces:autorise")) continue;
    rate("espace", `${court(f)}:${i + 1}`, `lien vers l'espace commerçant : ${ligne.trim()}`);
  }
}

// ---------------------------------------------------------------------
// 7. Un composant de fil qui reçoit `espace` porte sa garde.
// ---------------------------------------------------------------------
// Ces composants sont montés par DEUX routes, une par espace. Le chemin
// emprunté est donc une affirmation — « je suis le côté client de ce
// fil » — et `getThreadContext` sait si elle est vraie. Sans confronter
// les deux, un commerçant qui ouvre l'adresse client obtient l'écran
// habillé en client.
//
// La règle existe parce que l'oubli s'est produit : `ThreadScreen`
// portait cette garde, ses trois feuilles sœurs ne l'avaient pas. C'est
// le même motif que les sept gardes recopiées de `/vendeur` dont la
// huitième manquait — une protection écrite à la main sur N écrans
// finit toujours par manquer sur le N+1.
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
