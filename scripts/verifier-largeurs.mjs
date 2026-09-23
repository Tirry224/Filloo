/**
 * Signale tout débordement horizontal, écran par écran et largeur par largeur.
 *
 *     npm run build && npm start
 *     npm run largeurs                  écrans publics
 *     npm run largeurs -- --connecte    ouvre Chrome : on s'y connecte à la main
 *
 * Playwright n'est pas une dépendance : `npm i --no-save playwright-core`.
 * Chrome du système, ou chemin donné par CHROME=.
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

/* 844 : un téléphone en paysage. */
const LARGEURS = [320, 390, 768, 834, 844, 1024, 1440, 1920];

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

/* Les adresses à identifiant se découvrent en suivant les liens. */
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

/* Un élément dans un parent qui défile à l'horizontale (ChipRow) dépasse exprès. */
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
  /* Sonder par une requête et non par `page.goto` : naviguer la fenêtre
     effacerait le formulaire pendant la saisie. */
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const reponse = await contexte.request.get(BASE + "/compte", { maxRedirects: 0, timeout: 15000 });
      const vers = reponse.headers()["location"] ?? "";
      if (reponse.status() === 200 || (vers && !vers.includes("/connexion"))) {
        ouverte = true;
        break;
      }
    } catch {}
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
