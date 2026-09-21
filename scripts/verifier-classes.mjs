/**
 * Vérifie que CHAQUE classe Tailwind écrite dans src/ produit réellement
 * du CSS.
 *
 *     node scripts/verifier-classes.mjs
 *
 * Une classe Tailwind inexistante ne provoque aucune erreur : ni `tsc`, ni
 * `next build`, ni le navigateur ne disent rien, le style disparaît en
 * silence. Le vocabulaire fermé des tokens (`gap-hair`, `px-gutter`…)
 * aggrave le risque, une faute de frappe produisant le même silence. Sort
 * en code 1 si une classe est introuvable.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const RACINE = resolve(import.meta.dirname, "..");

/** Classes gérées par Tailwind sans qu'aucune règle ne porte leur nom. */
const IGNORER = new Set(["group", "peer", "dark", "container"]);

/**
 * Racines d'utilitaires Tailwind. Un mot dont la racine n'y est pas n'est
 * pas une classe : c'est ce qui écarte `lucide-react`, `current-password`
 * ou « inscrivez-vous ».
 */
const RACINES = new Set(
  `p px py pt pb pl pr ps pe m mx my mt mb ml mr gap space size w h min max
   text bg border rounded ring shadow font leading tracking truncate uppercase
   lowercase capitalize italic flex grid col row items justify content self
   place order top right bottom left inset absolute relative sticky fixed static
   overflow opacity aspect animate block inline hidden cursor transition duration
   ease resize tabular object z basis grow shrink whitespace break list divide
   outline select underline line decoration appearance backdrop blur scale rotate
   translate touch scroll snap caret placeholder from via to`
    .split(/\s+/)
    .filter(Boolean),
);

function fichiersTsx(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiersTsx(chemin);
    return chemin.endsWith(".tsx") || chemin.endsWith(".ts") ? [chemin] : [];
  });
}

/**
 * Toutes les chaînes des fichiers, et non les seuls attributs `className` :
 * l'essentiel des classes vit dans des tables `const STYLE = {…}`.
 */
function classesCandidates(texte, nomsDeTokens) {
  const trouvees = new Set();
  for (const [, contenu] of texte.matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
    const mots = contenu.trim().split(/\s+/).filter(Boolean);
    for (const brut of mots) {
      /* Les chaînes contiennent aussi du français, ponctuation comprise :
         « … py-section. », « gap-, p-, m- ». On la retire, et ce qui reste
         ouvert sur un tiret n'est pas une classe. */
      const mot = brut.trim().replace(/[.,;:!?)»]+$/, "");
      if (!mot || mot.length > 60 || mot.endsWith("-")) continue;
      // Lettres, chiffres et signes autorisés par Tailwind ; tout ce qui
      // ressemble à du texte est exclu.
      if (!/^-?[a-z][-a-z0-9:/.[\]()%#_]*$/.test(mot)) continue;
      if (!/[-/]/.test(mot)) continue;
      // La racine est le premier segment, variantes et signe négatif retirés.
      const nu = mot.replace(/^-/, "").replace(/^((?:[a-z-]+:)+)/, "");
      const racine = nu.split("-")[0];
      if (!RACINES.has(racine)) continue;
      /* Une chaîne d'un seul mot est ambiguë : « p-gutter » est une
         classe, « p-riz » un identifiant de produit. On ne la retient que
         si son suffixe est déclaré dans tokens.css, ou qu'elle porte un
         chiffre, une variante ou une fraction. */
      if (mots.length === 1) {
        const suffixe = nu.slice(racine.length + 1);
        const reconnaissable = /[0-9:[\]/.]/.test(mot) || nomsDeTokens.has(suffixe);
        if (!reconnaissable) continue;
      }
      trouvees.add(mot);
    }
  }
  return trouvees;
}

/** Tailwind échappe les caractères spéciaux dans les sélecteurs. */
function selecteur(classe) {
  return "." + classe.replace(/[.\/:%[\]()#,]/g, (c) => "\\" + c);
}

const css = await postcss([tailwind()]).process(
  readFileSync(join(RACINE, "src/styles/index.css"), "utf8"),
  { from: join(RACINE, "src/styles/index.css") },
);

/* Les noms déclarés dans tokens.css : hair, gutter, mark, accent, paper… */
const nomsDeTokens = new Set(
  [...readFileSync(join(RACINE, "src/styles/tokens.css"), "utf8").matchAll(
    /--(?:spacing|color|text|radius|leading|font|shadow|container)-([a-z0-9-]+)\s*:/g,
  )].map(([, nom]) => nom),
);

const fichiers = fichiersTsx(join(RACINE, "src"));
const manquantes = new Map();

for (const fichier of fichiers) {
  for (const classe of classesCandidates(readFileSync(fichier, "utf8"), nomsDeTokens)) {
    if (IGNORER.has(classe)) continue;
    // Les variantes (hover:, last:, md:…) sont retirées pour la recherche :
    // seule la base produit un sélecteur nommé.
    const base = classe.replace(/^((?:[a-z-]+:)+)/, "");
    if (css.css.includes(selecteur(base))) continue;
    // Une variante seule (`hover:bg-accent`) apparaît telle quelle.
    if (css.css.includes(selecteur(classe))) continue;
    if (!manquantes.has(classe)) manquantes.set(classe, []);
    manquantes.get(classe).push(fichier.slice(RACINE.length + 1));
  }
}

if (manquantes.size === 0) {
  console.log(`✓ ${fichiers.length} fichiers vérifiés, aucune classe fantôme.`);
  process.exit(0);
}

console.error(`✗ ${manquantes.size} classe(s) ne produisent aucun CSS :\n`);
for (const [classe, ou] of [...manquantes].sort()) {
  console.error(`  ${classe}`);
  for (const f of [...new Set(ou)]) console.error(`      ${f}`);
}
console.error(
  "\nUne classe absente ne casse rien : elle ne fait rien. Vérifie le nom, ou\najoute le token manquant dans src/styles/tokens.css.",
);
process.exit(1);
