/**
 * Les deux parcours, rôle par rôle : qui entre où, et où part celui qu'on
 * refuse.
 *
 * POURQUOI CE TEST TOURNE SANS BASE NI NAVIGATEUR
 * La règle vérifiée ici — « un client n'entre jamais dans l'espace
 * commerçant, et réciproquement » — ne dépend ni de Supabase ni de Next :
 * c'est une fonction des profils que porte la connexion. Elle vit donc
 * dans `src/lib/data/espace-decision.ts`, isolée exprès de la base et de
 * `redirect()`, et ce fichier l'exerce sur TOUTES les combinaisons.
 *
 * Ce n'est pas un substitut au parcours en navigateur (`npm run
 * parcours`), qui vérifie autre chose : que les écrans s'affichent et que
 * les formulaires partent. C'est le complément qui manquait — la table de
 * vérité des refus, que personne ne relit jamais à la main.
 *
 *     node scripts/verifier-gardes.mjs
 */

import { refusEspaceClient, refusEspaceCommercant } from "../src/lib/data/espace-decision.ts";

const anonyme = [];
const client = [{ role: "client", isSuspended: false }];
const clientSuspendu = [{ role: "client", isSuspended: true }];
const commercant = [{ role: "merchant", isSuspended: false }];
const commercantSuspendu = [{ role: "merchant", isSuspended: true }];
const lesDeux = [
  { role: "client", isSuspended: false },
  { role: "merchant", isSuspended: false },
];
const lesDeuxCommercantSuspendu = [
  { role: "client", isSuspended: false },
  { role: "merchant", isSuspended: true },
];

/* `attendu` : `null` = on entre. Une chaîne = le chemin de refus.
   Chaque ligne dit AUSSI pourquoi, parce qu'une table de vérité sans ses
   raisons se « corrige » un jour dans le mauvais sens pour faire passer
   un test. */
const cas = [
  // --- ESPACE COMMERÇANT ------------------------------------------------
  ["commerçant", anonyme, "/connexion",
   "personne n'est connecté : la seule réponse possible"],
  ["commerçant", client, "/",
   "LE CAS QUI COMPTE — un client authentifié n'entre pas, et ne se reconnecte pas non plus"],
  ["commerçant", clientSuspendu, "/",
   "client suspendu : toujours pas commerçant, le refus ne change pas de nature"],
  ["commerçant", commercant, null,
   "le parcours attendu"],
  ["commerçant", commercantSuspendu, "/compte/suspendu",
   "la suspension frappe le profil, et elle se dit plutôt que de laisser tout échouer en silence"],
  ["commerçant", lesDeux, null,
   "comptes liés (décision 8) : la même personne a le droit d'être ici"],
  ["commerçant", lesDeuxCommercantSuspendu, "/compte/suspendu",
   "comptes liés, côté commerçant suspendu : c'est le profil visé qui décide, pas la connexion"],

  // --- ESPACE CLIENT AUTHENTIFIÉ ---------------------------------------
  ["client", anonyme, "/connexion",
   "personne n'est connecté"],
  ["client", commercant, "/vendeur/boutique",
   "L'AUTRE SENS — un commerçant sans compte client part sur SON écran de compte, pas sur /connexion"],
  ["client", client, null,
   "le parcours attendu"],
  ["client", clientSuspendu, "/compte/suspendu",
   "même règle que côté commerçant : la suspension se dit"],
  ["client", lesDeux, null,
   "comptes liés : l'espace client lui est légitime"],
  ["client", commercantSuspendu, "/vendeur/boutique",
   "commerçant suspendu SANS compte client : le refus porte sur l'absence de compte client, pas sur la suspension"],
];

let echecs = 0;
const nom = (profils) =>
  profils.length === 0
    ? "anonyme"
    : profils.map((p) => `${p.role}${p.isSuspended ? " (suspendu)" : ""}`).join(" + ");

console.log("");
for (const [espace, profils, attendu, pourquoi] of cas) {
  const obtenu = espace === "commerçant" ? refusEspaceCommercant(profils) : refusEspaceClient(profils);
  const ok = obtenu === attendu;
  if (!ok) echecs++;
  const verdict = attendu === null ? "ENTRE" : `→ ${attendu}`;
  console.log(
    `${ok ? "  OK   " : " ÉCHEC "} espace ${espace.padEnd(10)} · ${nom(profils).padEnd(34)} ${verdict}`,
  );
  console.log(`         ${pourquoi}`);
  if (!ok) console.log(`         OBTENU : ${obtenu === null ? "ENTRE" : `→ ${obtenu}`}`);
}

/* L'invariant qui résume le critère de réussite, et qu'aucune ligne
   ci-dessus ne peut contredire sans le dire : une connexion qui ne porte
   PAS le profil d'un espace n'y entre jamais. Écrit à part parce qu'une
   table se relit ligne à ligne, et qu'on peut en casser le sens général
   sans qu'aucune ligne n'ait l'air fausse. */
const toutesLesCombinaisons = [
  anonyme, client, clientSuspendu, commercant, commercantSuspendu,
  lesDeux, lesDeuxCommercantSuspendu,
];
for (const profils of toutesLesCombinaisons) {
  const aCommercantActif = profils.some((p) => p.role === "merchant" && !p.isSuspended);
  const aClientActif = profils.some((p) => p.role === "client" && !p.isSuspended);
  if (refusEspaceCommercant(profils) === null && !aCommercantActif) {
    console.log(` ÉCHEC invariant : ${nom(profils)} entre dans l'espace commerçant sans profil commerçant actif`);
    echecs++;
  }
  if (refusEspaceClient(profils) === null && !aClientActif) {
    console.log(` ÉCHEC invariant : ${nom(profils)} entre dans l'espace client sans profil client actif`);
    echecs++;
  }
}

console.log("");
if (echecs === 0) {
  console.log(`✓ ${cas.length} cas vérifiés, aucun franchissement d'espace.`);
  process.exit(0);
}
console.error(`✗ ${echecs} garde(s) laissent passer ce qu'elles devraient refuser.`);
process.exit(1);
