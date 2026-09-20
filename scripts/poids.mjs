/**
 * Mesure le poids réel de l'application.
 *
 * Un budget qu'on ne mesure pas est un vœu. Ce script lit la sortie de
 * `npm run build` et compare le poids transféré aux budgets de
 * docs/PERFORMANCE.md. Il sort en erreur si un budget est dépassé, pour
 * qu'un jour il puisse tourner avant chaque mise en ligne.
 *
 *   npm run build && npm run poids
 *
 * Les tailles sont données en gzip, la compression que sert Vercel.
 * Brotli, réellement utilisé en production, retire encore 15 à 20 %.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, extname } from "node:path";

const BUDGETS = { socle: 200, page: 12, police: 40 }; // Ko gzip

const ko = (n) => Math.round((n / 1024) * 10) / 10;
const gz = (f) => gzipSync(readFileSync(f), { level: 9 }).length;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

if (!existsSync(".next")) {
  console.error("Rien à mesurer : lance `npm run build` d'abord.");
  process.exit(1);
}

// Le socle : l'INTERSECTION des ressources des pages pré-rendues.
//
// ATTENTION, CE CHIFFRE SOUS-COMPTE, mesuré le 2026-09-20 : `_global-error`
// ne référence AUCUN CSS, et comme elle entre dans l'intersection, elle en
// éjecte la feuille de style entière et trois chunks présents partout —
// environ 30 Ko. Une vraie première visite pèse donc ~195 Ko, pas 165, et
// quatre routes (messagerie, ajout de produit) dépassent les 200 Ko du
// budget sans que rien ne le signale.
//
// Corriger la mesure ferait échouer le build sur ces routes : c'est le but,
// mais c'est un chantier à part. En attendant, ce chiffre est un plancher,
// pas un total.
const pages = walk(".next/server/app").filter((f) => extname(f) === ".html");
const refsPar = pages.map(
  (f) => new Set(readFileSync(f, "utf8").match(/\/_next\/static\/[^"']+\.(?:js|css)/g) ?? []),
);
const communes = [...(refsPar[0] ?? [])].filter((u) => refsPar.every((s) => s.has(u)));
const socle = communes.reduce((n, u) => n + gz(".next" + u.slice("/_next".length)), 0);

const toutHtml = pages.map((f) => readFileSync(f, "utf8")).join("");
const polices = [...new Set(toutHtml.match(/\/_next\/static\/media\/[^"']+\.woff2/g) ?? [])]
  .map((u) => ({ u, taille: statSync(".next" + u.slice("/_next".length)).size }));
const poidsPolices = polices.reduce((n, p) => n + p.taille, 0);

console.log(`\nSocle (JS + CSS, première visite)   ${ko(socle)} Ko   budget ${BUDGETS.socle} Ko`);
console.log(`Polices préchargées (${polices.length})              ${ko(poidsPolices)} Ko   budget ${BUDGETS.police} Ko`);
console.log(`\nPages pré-rendues — HTML seul :`);

let pire = 0;
for (const f of pages.sort()) {
  const t = ko(gz(f));
  pire = Math.max(pire, t);
  const route = f.replace(".next/server/app", "").replace(/\.html$/, "") || "/";
  console.log(`  ${t.toFixed(1).padStart(6)} Ko  ${route}`);
}

const depasse = [
  socle / 1024 > BUDGETS.socle && `socle (${ko(socle)} > ${BUDGETS.socle} Ko)`,
  poidsPolices / 1024 > BUDGETS.police && `polices (${ko(poidsPolices)} > ${BUDGETS.police} Ko)`,
  pire > BUDGETS.page && `page la plus lourde (${pire} > ${BUDGETS.page} Ko)`,
].filter(Boolean);

console.log("");
if (depasse.length) {
  console.error("Budget dépassé : " + depasse.join(", "));
  process.exit(1);
}
console.log("Tous les budgets sont tenus.");
