/**
 * Les parcours qui doivent marcher, vérifiés dans un vrai navigateur.
 *
 *   npm run build && npm start        (dans un terminal)
 *   npm run parcours                  (dans un autre)
 *
 * Deux passages : avec JavaScript, puis SANS. Le second est INFORMATIF
 * depuis le 2026-09-22 : l'exigence « tout écran doit marcher sans
 * JavaScript » a été retirée des règles du projet (docs/PERFORMANCE.md).
 * Il reste utile — il montre ce que voit quelqu'un dont le script n'a pas
 * fini de charger — mais un échec de ce passage n'est plus un défaut à
 * corriger, c'est une information.
 *
 * ⚠️ CE SCRIPT NE TOURNE PLUS EN L'ÉTAT. Il désigne des enregistrements
 * de démonstration (`p-parfum`, `t-mariama`) supprimés de la base le
 * 2026-09-12, et Playwright n'est pas une dépendance du projet. À
 * réécrire sur de vraies données avant de s'y fier — le laisser croire
 * qu'il vérifie quelque chose serait pire que son absence.
 *
 * Playwright n'est PAS une dépendance du projet. À installer à la main :
 *   npm i -D playwright-core && npx playwright install chromium
 * Le chemin du navigateur se donne par CHROMIUM= si besoin.
 */
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

/** Un PNG minuscule mais valide, pour les champs de photo. */
const PHOTO = {
  name: 'produit.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
};

const B = process.env.BASE ?? 'http://localhost:3000';

/** Le binaire de Chromium, là où Playwright le range d'habitude. */
function navigateur() {
  const candidats = [
    process.env.CHROMIUM,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    `${process.env.HOME}/.cache/ms-playwright/chromium-1194/chrome-linux/chrome`,
  ].filter(Boolean);
  const trouve = candidats.find((c) => existsSync(c));
  if (!trouve) {
    console.error(
      "Chromium introuvable. Installe-le (npx playwright install chromium) " +
      "ou donne son chemin : CHROMIUM=/chemin/vers/chrome npm run parcours",
    );
    process.exit(2);
  }
  return trouve;
}
let echecs = 0;
const ok = (c, m) => { if (!c) echecs++; console.log((c ? '  OK   ' : ' ÉCHEC ') + m); };

(async () => {
  const b = await chromium.launch({ executablePath: navigateur() });

  console.log('\n── Avec JavaScript ──');
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  let requetes = 0;
  p.on('request', (r) => { if (r.method() === 'POST') requetes++; });

  // Un formulaire vide ne part pas : le navigateur le retient, zéro octet
  // dépensé.
  await p.goto(B + '/inscription');
  await p.click('button[type=submit]');
  await p.waitForTimeout(1000);
  ok(requetes === 0, 'formulaire vide : aucune requête envoyée');
  ok(new URL(p.url()).search === '', "on reste sur place, rien à recharger");
  await p.fill('#nom', 'Mariama Diallo');
  await p.fill('#telephone', '620 45 12 87');
  await p.fill('#email', 'pas-un-email');
  await p.fill('#motdepasse', 'motdepasse1');
  await p.click('button[type=submit]');
  await p.waitForTimeout(1200);
  ok(requetes === 0, "email sans @ : le navigateur bloque avant toute requête");
  ok((await p.locator('#motdepasse').inputValue()) === 'motdepasse1', 'le mot de passe reste saisi (aucun rechargement)');

  // « mariama@exemple » passe la validation du navigateur mais pas la
  // nôtre : c'est le serveur qui doit trancher, et il tranche.
  await p.fill('#email', 'mariama@exemple');
  await p.click('button[type=submit]');
  await p.waitForURL(/erreur=email/, { timeout: 15000 }).catch(() => {});
  ok(p.url().includes('erreur=email'), 'email sans domaine complet refusé par le serveur (' + new URL(p.url()).search + ')');
  ok((await p.locator('#nom').inputValue()) === 'Mariama Diallo', 'le nom saisi est conservé');
  ok(!p.url().includes('motdepasse'), "le mot de passe n'est JAMAIS dans l'URL");

  await p.fill('#email', 'mariama@exemple.com');
  // Le mot de passe ne voyage jamais dans l'URL : on le retape, comme le
  // ferait la personne.
  ok((await p.locator('#motdepasse').inputValue()) === '', "le mot de passe n'est pas réaffiché après un refus");
  await p.fill('#motdepasse', 'motdepasse1');
  await p.click('text=Vendre');
  await p.click('button[type=submit]');
  await p.waitForURL(/boutique/, { timeout: 15000 }).catch(() => {});
  ok(p.url().endsWith('/inscription/boutique'), 'vendeur → étape boutique (' + p.url() + ')');

  await p.goto(B + '/recherche');
  await p.fill('input[name=q]', 'iphone');
  await p.press('input[name=q]', 'Enter');
  await p.waitForLoadState('networkidle');
  ok(p.url().includes('q=iphone'), "la recherche passe par l'URL");
  ok((await p.locator('text=iPhone 11 64 Go').count()) > 0, 'résultats affichés');

  await p.goto(B + '/recherche');
  await p.waitForTimeout(400);
  ok((await p.locator('text=Recherches récentes').count()) > 0, 'recherche récente mémorisée');

  console.log('\n── Sans JavaScript ──');
  const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const s = await ctx.newPage();
  await s.goto(B + '/inscription');
  await s.fill('#nom', 'Ibrahima Camara');
  await s.fill('#telephone', '622334455');
  await s.fill('#email', 'ibrahima@exemple.com');
  await s.fill('#motdepasse', 'motdepasse1');
  await s.click('button[type=submit]');
  await s.waitForLoadState('load');
  ok(new URL(s.url()).pathname === '/', 'inscription acheteur aboutit (' + s.url() + ')');

  await s.goto(B + '/recherche');
  await s.fill('input[name=q]', 'parfum');
  await s.press('input[name=q]', 'Enter');
  await s.waitForLoadState('load');
  ok(s.url().includes('q=parfum'), 'la recherche fonctionne');

  await s.goto(B + '/recherche?q=iphone');
  await s.locator('summary').nth(1).click();
  await s.waitForTimeout(200);
  ok(await s.locator('text=Accessoires téléphone').isVisible(), "le menu de filtre s'ouvre");

  await s.goto(B + '/messages/t-mariama');
  await s.fill('input[name=message]', 'Bonjour, il est encore disponible ?');
  await s.click('button[type=submit]');
  await s.waitForLoadState('load');
  ok(s.url().includes('/messages/t-mariama'), 'message envoyé');

  await s.goto(B + '/vendeur/produits/nouveau');
  await s.fill('#titre', 'iPhone 12 128 Go');
  await s.selectOption('#categorie', 'telephones');
  // Le brouillon échappe aux règles : c'est sa raison d'être — photo comprise.
  await s.click('button[name=brouillon]');
  await s.waitForLoadState('load');
  ok(new URL(s.url()).pathname === '/vendeur', 'brouillon accepté sans prix (' + s.url() + ')');

  await s.goto(B + '/vendeur/produits/nouveau');
  await s.fill('#titre', 'iPhone 12 128 Go');
  await s.selectOption('#categorie', 'telephones');
  await s.fill('#prix', '4 200 000');
  await s.click('button[type=submit]');
  await s.waitForLoadState('load');
  ok(s.url().includes('erreur=photo'), 'publication sans photo refusée (' + new URL(s.url()).search + ')');

  await s.setInputFiles('#photos', PHOTO);
  await s.fill('#prix', '4 200 000');
  await s.click('button[type=submit]');
  await s.waitForLoadState('load');
  ok(new URL(s.url()).pathname === '/vendeur', 'produit publié avec sa photo (' + s.url() + ')');

  await s.goto(B + '/produit/p-parfum/signaler');
  await s.click('text=Contrefaçon');
  await s.click('button[type=submit]');
  await s.waitForLoadState('load');
  ok(s.url().includes('signale=1'), 'signalement envoyé (' + s.url() + ')');

  // ── Ce que l'action CHANGE à l'écran ────────────────────────────────
  //
  // Les vérifications précédentes regardent où l'on atterrit ; celles-ci
  // regardent l'écran d'après. Un formulaire qui accepte puis oublie est
  // pire qu'un bouton mort.
  console.log('\n── Ce que l\'action change à l\'écran ──');
  const u = await b.newContext({ viewport: { width: 390, height: 844 } });
  const e = await u.newPage();
  const marque = 'Samsung A' + (Date.now() % 100000);

  await e.goto(B + '/vendeur/produits/nouveau', { waitUntil: 'networkidle' });
  await e.setInputFiles('#photos', PHOTO);
  await e.fill('#titre', marque + ' 128 Go');
  await e.selectOption('#categorie', 'telephones');
  await e.selectOption('#condition', 'occasion');
  await e.fill('#prix', '1 850 000');
  await e.click('button[type=submit]:has-text("Publier")');
  await e.waitForTimeout(1500);
  ok((await e.locator('body').innerText()).includes(marque), 'le produit publié apparaît dans mes produits');
  await e.goto(B + '/recherche?q=' + encodeURIComponent(marque), { waitUntil: 'networkidle' });
  ok((await e.locator('body').innerText()).includes(marque), 'et le client le trouve par la recherche');

  const mot = 'Disponible ? ' + Date.now();
  await e.goto(B + '/messages/t-mariama', { waitUntil: 'networkidle' });
  await e.fill('input[name=message]', mot);
  await e.click('button[aria-label=Envoyer]');
  await e.waitForTimeout(1500);
  ok((await e.locator('body').innerText()).includes(mot), 'le message envoyé apparaît dans le fil');

  await e.goto(B + '/inscription', { waitUntil: 'networkidle' });
  await e.fill('#nom', 'Fatoumata Bah');
  await e.fill('#telephone', '622112233');
  await e.fill('#email', 'fatou@exemple.com');
  await e.fill('#motdepasse', 'motdepasse1');
  await e.click('button[type=submit]');
  await e.waitForTimeout(1500);
  await e.goto(B + '/compte', { waitUntil: 'networkidle' });
  ok((await e.locator('body').innerText()).includes('Fatoumata'), "après inscription, l'application sait qui je suis");

  await e.goto(B + '/produit/p-parfum/contacter', { waitUntil: 'networkidle' });
  ok(new URL(e.url()).pathname.startsWith('/messages'), "connecté, on n'exige plus de compte pour écrire");

  await e.goto(B + '/compte', { waitUntil: 'networkidle' });
  await e.click('text=Se déconnecter');
  await e.waitForTimeout(1500);
  await e.goto(B + '/compte', { waitUntil: 'networkidle' });
  ok((await e.locator('body').innerText()).includes('pas connecté'), 'la déconnexion referme la session');

  console.log(echecs === 0 ? '\nTout passe.' : `\n${echecs} échec(s).`);
  await b.close();
  process.exit(echecs === 0 ? 0 : 1);
})();
