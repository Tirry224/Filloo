/**
 * Ouvre CHAQUE écran à CHAQUE largeur standard, et signale ce qui dépasse.
 *
 *     npm run build && npm start        (dans un terminal)
 *     npm run largeurs                  (dans un autre)
 *
 * Ce que ce script voit, et que rien d'autre ne voit : `typecheck`,
 * `build` et `classes` valident du code, pas une mise en page. Une colonne
 * qui sort de l'écran sur un téléphone de 320 px ne produit aucune erreur
 * nulle part — elle se constate, ou elle part en production.
 *
 * Ce qu'il NE voit PAS, et qu'il ne faut pas lui demander : un contenu
 * centré qui devrait être à gauche, une hiérarchie visuelle ratée, une
 * densité trop lâche. Un débordement est un fait mesurable ; le reste se
 * regarde.
 *
 * ─────────────────────────────────────────────────────────────────────
 * LES ÉCRANS QUI EXIGENT UNE SESSION
 * ─────────────────────────────────────────────────────────────────────
 * La moitié de l'application est derrière une connexion, et aucun mot de
 * passe ne doit se trouver dans ce dépôt. D'où `--connecte` : le script
 * ouvre un vrai Chrome, VOUS vous y connectez à la main, et il reprend
 * tout seul dès qu'il constate que la session est ouverte. Le profil est
 * conservé dans `.chrome-profil/` (ignoré par Git) : la fois suivante,
 * il n'y a plus rien à saisir.
 *
 *     npm run largeurs -- --connecte
 *
 * ─────────────────────────────────────────────────────────────────────
 * Playwright n'est PAS une dépendance du projet — un navigateur pèse plus
 * que l'application entière. À installer une fois, à la main :
 *
 *     npm i -D playwright-core
 *
 * Le navigateur utilisé est le Chrome du système ; son chemin se donne
 * par CHROME= si l'installation n'est pas à l'endroit habituel.
 */
import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const RACINE = resolve(import.meta.dirname, "..");
const BASE = process.env.BASE ?? "http://localhost:3000";
const PROFIL = resolve(RACINE, ".chrome-profil");
const SORTIE = resolve(RACINE, ".captures");

const CHROMES = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const CHROME = CHROMES.find((c) => existsSync(c));
if (!CHROME) {
  console.error("Aucun Chrome trouvé. Donnez son chemin par CHROME=…");
  process.exit(1);
}

const AVEC_SESSION = process.argv.includes("--connecte");

/**
 * Les largeurs qui comptent. 320 est le plus petit téléphone encore
 * vendu, et c'est la cible réelle de Makiti ; 844 est un téléphone
 * TOURNÉ, cas qu'on oublie toujours ; 1920 est le bureau ordinaire.
 */
const LARGEURS = [320, 390, 768, 834, 844, 1024, 1440, 1920];

/** Les écrans qu'un visiteur sans compte atteint. */
const PUBLICS = [
  "/",
  "/recherche",
  "/recherche?q=a",
  "/connexion",
  "/inscription",
  "/inscription/boutique",
  "/mot-de-passe-oublie",
  "/conditions",
  "/confidentialite",
  "/contact",
  "/styleguide",
  "/ecrans",
  "/adresse-qui-nexiste-pas",
];

/** Les écrans qui exigent une session ouverte. */
const PRIVES = [
  "/compte",
  "/compte/informations",
  "/compte/informations/supprimer",
  "/messages",
  "/vendeur",
  "/vendeur/produits",
  "/vendeur/produits/nouveau",
  "/vendeur/messages",
  "/vendeur/boutique",
  "/vendeur/boutique/modifier",
  "/vendeur/informations",
  "/vendeur/conditions",
  "/vendeur/confidentialite",
  "/vendeur/contact",
];

/**
 * Les écrans dont l'adresse contient un identifiant ne peuvent pas être
 * écrits en dur : ils se DÉCOUVRENT en suivant les liens de la page qui y
 * mène, comme le ferait quelqu'un qui utilise l'application.
 */
async function decouvrir(page) {
  const trouves = [];

  async function premierLien(depuis, motif) {
    try {
      await page.goto(BASE + depuis, { waitUntil: "domcontentloaded", timeout: 20000 });
      const href = await page.evaluate((m) => {
        const a = [...document.querySelectorAll("a[href]")].find((x) =>
          new RegExp(m).test(x.getAttribute("href")),
        );
        return a?.getAttribute("href") ?? null;
      }, motif);
      return href;
    } catch {
      return null;
    }
  }

  const produit = await premierLien("/", "^/produit/[0-9a-f-]+$");
  if (produit) trouves.push(produit, `${produit}/photos`, `${produit}/contacter`, `${produit}/signaler`);

  const boutique = produit ? await premierLien(produit, "^/boutique/[0-9a-f-]+$") : null;
  if (boutique) trouves.push(boutique);

  if (AVEC_SESSION) {
    const fil = await premierLien("/messages", "^/messages/[0-9a-f-]+$");
    if (fil) trouves.push(fil, `${fil}/actions`, `${fil}/citer`, `${fil}/signaler`);

    const filVendeur = await premierLien("/vendeur/messages", "^/vendeur/messages/[0-9a-f-]+$");
    if (filVendeur) trouves.push(filVendeur, `${filVendeur}/actions`, `${filVendeur}/citer`, `${filVendeur}/signaler`);

    const produitVendeur = await premierLien("/vendeur/produits", "^/vendeur/produits/[0-9a-f-]+/");
    if (produitVendeur) {
      const id = produitVendeur.split("/")[3];
      trouves.push(`/vendeur/produits/${id}/actions`, `/vendeur/produits/${id}/modifier`);
    }
  }

  return [...new Set(trouves)];
}

/**
 * CE QUI COMPTE COMME UN DÉBORDEMENT. Un élément qui sort du cadre n'en
 * est un que si aucun de ses parents ne défile horizontalement EXPRÈS :
 * la rangée de puces de catégories est faite pour dépasser, s'en plaindre
 * rendrait le script inutilisable.
 */
async function mesurer(page) {
  return page.evaluate(() => {
    const vue = document.documentElement.clientWidth;
    const coupables = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right <= vue + 1 && r.left >= -1) continue;

      let parent = el.parentElement;
      let voulu = false;
      while (parent) {
        const s = getComputedStyle(parent);
        if (s.overflowX === "auto" || s.overflowX === "scroll") {
          voulu = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (voulu) continue;

      const classes = (el.className || "").toString().split(" ").slice(0, 3).join(".");
      coupables.push(`${el.tagName.toLowerCase()}.${classes} [${Math.round(r.left)}→${Math.round(r.right)}]`);
    }
    return {
      defile: document.documentElement.scrollWidth > vue + 1,
      coupables: [...new Set(coupables)].slice(0, 5),
      adresse: location.pathname,
    };
  });
}

/** Une redirection vers /connexion veut dire que la session a expiré. */
function estRedirigeVersConnexion(chemin, rapport) {
  return chemin !== "/connexion" && rapport.adresse === "/connexion";
}

mkdirSync(SORTIE, { recursive: true });

const contexte = AVEC_SESSION
  ? await chromium.launchPersistentContext(PROFIL, {
      executablePath: CHROME,
      headless: false,
      viewport: { width: 1280, height: 900 },
      locale: "fr-FR",
    })
  : await chromium.launchPersistentContext(PROFIL, {
      executablePath: CHROME,
      headless: true,
      viewport: { width: 390, height: 780 },
      locale: "fr-FR",
    });

const page = contexte.pages()[0] ?? (await contexte.newPage());

if (AVEC_SESSION) {
  await page.goto(BASE + "/connexion", { waitUntil: "domcontentloaded" });
  console.log("\n  Connectez-vous dans la fenêtre Chrome qui vient de s'ouvrir.");
  console.log("  Le script reprend tout seul dès que la session est ouverte.\n");

  const limite = Date.now() + 10 * 60 * 1000;
  let ouverte = false;
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      await page.goto(BASE + "/compte", { waitUntil: "domcontentloaded", timeout: 15000 });
      if (new URL(page.url()).pathname !== "/connexion") {
        ouverte = true;
        break;
      }
    } catch {
      /* la fenêtre est peut-être en train de naviguer : on réessaie */
    }
  }
  if (!ouverte) {
    console.error("Session jamais ouverte au bout de dix minutes. Abandon.");
    await contexte.close();
    process.exit(1);
  }
  console.log("✓ Session ouverte, reprise du parcours.\n");
}

const dynamiques = await decouvrir(page);
const ECRANS = [...PUBLICS, ...(AVEC_SESSION ? PRIVES : []), ...dynamiques];

const problemes = [];
const inaccessibles = [];

for (const largeur of LARGEURS) {
  await page.setViewportSize({ width: largeur, height: largeur < 500 ? 780 : 900 });

  for (const chemin of ECRANS) {
    try {
      await page.goto(BASE + chemin, { waitUntil: "networkidle", timeout: 30000 });
    } catch (e) {
      problemes.push(`${largeur}px ${chemin} — ne charge pas : ${e.message.split("\n")[0]}`);
      continue;
    }

    const rapport = await mesurer(page);

    if (estRedirigeVersConnexion(chemin, rapport)) {
      if (largeur === LARGEURS[0]) inaccessibles.push(chemin);
      continue;
    }

    if (rapport.defile || rapport.coupables.length) {
      problemes.push(
        `${largeur}px ${chemin} — ${rapport.defile ? "LA PAGE DÉFILE À L'HORIZONTALE. " : ""}` +
          (rapport.coupables.length ? `dépasse : ${rapport.coupables.join(" ; ")}` : ""),
      );
    }

    const nom = chemin.replace(/[^a-z0-9]/gi, "_") || "accueil";
    await page.screenshot({ path: `${SORTIE}/${largeur}__${nom}.png`, fullPage: true });
  }
  console.log(`✓ ${largeur}px — ${ECRANS.length} écrans`);
}

await contexte.close();

if (inaccessibles.length) {
  console.log(`\nNON VÉRIFIÉS, la session n'y donne pas accès (${inaccessibles.length}) :`);
  for (const e of inaccessibles) console.log("  · " + e);
}

console.log("\n══════ DÉBORDEMENTS ══════");
if (problemes.length === 0) {
  console.log(`Aucun, sur ${ECRANS.length - inaccessibles.length} écrans et ${LARGEURS.length} largeurs.`);
  console.log(`Captures dans ${SORTIE}`);
} else {
  for (const p of problemes) console.log("• " + p);
  console.log(`\n${problemes.length} à corriger. Captures dans ${SORTIE}`);
  process.exit(1);
}
