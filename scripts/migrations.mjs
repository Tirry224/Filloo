/**
 * Compare les migrations du dépôt à celles que la production a reçues.
 *
 *     npm run migrations
 *     npm run migrations -- --json liste.json
 *
 * Deux pièges sont arrivés, symétriques, et aucun ne fait d'erreur :
 *
 * - une migration APPLIQUÉE au tableau de bord sans être commitée — cinq
 *   migrations et une décision d'architecture ont vécu uniquement en
 *   production ;
 * - une migration COMMITÉE sans être appliquée — `0026` (cinq photos) est
 *   partie avec le code le 2026-09-24, et la base a refusé la 4e photo
 *   que l'app proposait jusqu'au 25.
 *
 * SOURCE DE LA LISTE DE PRODUCTION, au choix :
 *
 * - par défaut, l'API de gestion de Supabase, qui lit
 *   `supabase_migrations.schema_migrations`. Il faut un jeton personnel
 *   (supabase.com → Account → Access Tokens) dans `SUPABASE_ACCESS_TOKEN`,
 *   posé dans `.env.local` — JAMAIS dans `.env`, qui est versionné : ce
 *   jeton ouvre TOUS les projets du compte, pas seulement Filloo ;
 * - `--json <fichier>` : la liste déjà obtenue ailleurs, par exemple par
 *   le connecteur Supabase d'une session (`list_migrations`), qui ne
 *   joint pas `api.supabase.com`. Formes acceptées : `{ migrations: [...] }`
 *   ou un tableau de `{ version, name }`.
 *
 * Code de sortie 1 s'il manque une migration d'un côté ou de l'autre :
 * c'est un contrôle à lancer avant de pousser, pas un rapport à lire.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DOSSIER = "supabase/migrations";

/**
 * La clé qui rapproche un fichier de sa ligne en production. Les neuf
 * premières migrations appliquées au tableau de bord ont perdu leur
 * numéro (`profile_suspension_date` pour `0009_profile_suspension_date`) :
 * on compare donc le nom SANS le préfixe à quatre chiffres.
 */
export function cle(nom) {
  return nom.replace(/\.sql$/, "").replace(/^\d{4}_/, "");
}

/**
 * La comparaison seule, sans réseau ni disque, pour être testée.
 *
 * @param {string[]} fichiers noms des fichiers de `supabase/migrations/`
 * @param {{ version: string, name: string }[]} appliquees lignes de production
 */
export function comparerMigrations(fichiers, appliquees) {
  const locales = [...fichiers].filter((f) => f.endsWith(".sql")).sort();
  const enProduction = [...appliquees].sort((a, b) => a.version.localeCompare(b.version));

  const clesLocales = new Set(locales.map(cle));
  const clesProduction = new Set(enProduction.map((m) => cle(m.name)));

  const nonAppliquees = locales.filter((f) => !clesProduction.has(cle(f))).map((f) => f.replace(/\.sql$/, ""));
  const nonCommitees = enProduction.filter((m) => !clesLocales.has(cle(m.name))).map((m) => m.name);

  /* Hors ordre : appliquée APRÈS une migration qui la suit dans le
     dépôt. Rien ne se répare après coup — une migration appliquée ne se
     réécrit pas — mais une migration qui en suppose une autre a pu
     tourner sans elle : cela se relit. Signalé, sans faire échouer. */
  const rang = new Map(locales.map((f, i) => [cle(f), i]));
  const horsOrdre = [];
  let rangMax = -1;
  for (const m of enProduction) {
    const r = rang.get(cle(m.name));
    if (r === undefined) continue;
    if (r < rangMax) horsOrdre.push(m.name);
    rangMax = Math.max(rangMax, r);
  }

  return { nonAppliquees, nonCommitees, horsOrdre, total: locales.length };
}

/** `process.env` gagne, comme chez Next : `.env.local` puis `.env` ne
 * remplissent que ce qui manque. */
function chargerEnv() {
  for (const fichier of [".env.local", ".env"]) {
    if (!existsSync(fichier)) continue;
    for (const ligne of readFileSync(fichier, "utf8").split(/\r?\n/)) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

function lireJson(chemin) {
  const brut = JSON.parse(readFileSync(chemin, "utf8"));
  const liste = Array.isArray(brut) ? brut : brut.migrations;
  if (!Array.isArray(liste)) throw new Error(`${chemin} : ni un tableau, ni un objet { migrations: [...] }.`);
  return liste;
}

async function lireProduction() {
  chargerEnv();
  const jeton = process.env.SUPABASE_ACCESS_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projet = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!projet) throw new Error("NEXT_PUBLIC_SUPABASE_URL ne désigne pas un projet Supabase (https://<projet>.supabase.co).");
  if (!jeton) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN manque. Crée un jeton sur supabase.com → Account → Access Tokens et pose-le dans .env.local, " +
        "ou passe une liste obtenue ailleurs : npm run migrations -- --json liste.json",
    );
  }

  const reponse = await fetch(`https://api.supabase.com/v1/projects/${projet}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "select version, name from supabase_migrations.schema_migrations order by version" }),
  });
  if (!reponse.ok) {
    throw new Error(`L'API Supabase a répondu ${reponse.status} : ${(await reponse.text()).slice(0, 200)}`);
  }
  return reponse.json();
}

async function principal() {
  const i = process.argv.indexOf("--json");
  const appliquees = i > -1 ? lireJson(process.argv[i + 1]) : await lireProduction();
  const { nonAppliquees, nonCommitees, horsOrdre, total } = comparerMigrations(readdirSync(DOSSIER), appliquees);

  for (const nom of nonAppliquees) console.log(`✗ dans le dépôt, PAS en production : ${nom}`);
  for (const nom of nonCommitees) console.log(`✗ en production, PAS dans le dépôt : ${nom}`);
  for (const nom of horsOrdre) console.log(`! appliquée hors ordre (après une migration qui la suit dans le dépôt) : ${nom}`);

  if (nonAppliquees.length || nonCommitees.length) {
    console.log("\nÀ appliquer : le fichier tel quel, depuis le tableau de bord ou le connecteur.");
    console.log("À commiter : la migration relue en production, sans la réécrire.");
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${total} migrations, les mêmes dans le dépôt et en production.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  principal().catch((erreur) => {
    console.error(`✗ ${erreur.message}`);
    process.exitCode = 1;
  });
}
