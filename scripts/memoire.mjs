/**
 * Régénère la section « Évolution, commit par commit » de docs/MEMOIRE.md
 * à partir de `git log`, entre ses deux marqueurs. Tout le reste du
 * fichier est écrit à la main et n'est jamais touché.
 *
 *   npm run memoire
 *
 * À lancer avant chaque commit, puis committer le fichier AVEC le travail.
 * Un commit ne peut pas citer sa propre empreinte : la liste s'arrête donc
 * au commit précédent, et le suivant la rattrape.
 *
 * L'historique n'est jamais écrit à la main : c'est ce qui avait fait
 * mourir deux fois l'ancien fichier de reprise, un journal recopié de Git
 * qui vieillissait sans que personne ne le relise.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const FICHIER = "docs/MEMOIRE.md";
const DEBUT = "<!-- DEBUT HISTORIQUE — généré par `npm run memoire`, ne pas éditer à la main -->";
const FIN = "<!-- FIN HISTORIQUE -->";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

/* Un clone partiel (celui des sessions, par défaut) ne voit que les
   derniers commits : écrire depuis lui effacerait le début de l'histoire
   sans aucun message d'erreur. */
if (git("rev-parse", "--is-shallow-repository") === "true") {
  console.error("Clone partiel : l'historique serait tronqué. Lance d'abord `git fetch --unshallow`.");
  process.exit(1);
}

const SEP = "\u001f";
const commits = git("log", `--format=%ad${SEP}%h${SEP}%s`, "--date=short")
  .split("\n")
  .filter(Boolean)
  .map((ligne) => {
    const [date, hash, sujet] = ligne.split(SEP);
    return { date, hash, sujet };
  });

/* Du plus récent au plus ancien : on relit ce fichier pour reprendre le
   travail, et c'est la fin de l'histoire qu'on cherche d'abord. */
const lignes = [`${commits.length} commits, du plus récent au plus ancien.`];
let jour = null;
for (const { date, hash, sujet } of commits) {
  if (date !== jour) {
    lignes.push("", `### ${date}`, "");
    jour = date;
  }
  lignes.push(`- \`${hash}\` ${sujet}`);
}

const texte = readFileSync(FICHIER, "utf8");
const debut = texte.indexOf(DEBUT);
const fin = texte.indexOf(FIN);
if (debut === -1 || fin === -1 || fin < debut) {
  console.error(`Marqueurs introuvables dans ${FICHIER} : rien n'a été écrit.`);
  process.exit(1);
}

const neuf = `${texte.slice(0, debut + DEBUT.length)}\n\n${lignes.join("\n")}\n\n${texte.slice(fin)}`;
if (neuf === texte) {
  console.log(`${FICHIER} est déjà à jour (${commits.length} commits).`);
} else {
  writeFileSync(FICHIER, neuf);
  console.log(`${FICHIER} régénéré : ${commits.length} commits.`);
}
