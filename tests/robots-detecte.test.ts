import { test } from "node:test";
import assert from "node:assert/strict";
import { nEstPasUnePersonne } from "../src/lib/robots-detecte.ts";

const entetes = (valeurs: Record<string, string>) => ({ get: (nom: string) => valeurs[nom.toLowerCase()] ?? null });

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";

test("un téléphone est une personne", () => {
  assert.equal(nEstPasUnePersonne(entetes({ "user-agent": IPHONE })), false);
  assert.equal(nEstPasUnePersonne(entetes({ "user-agent": ANDROID })), false);
  // Une marque de téléphone répandue, dont le nom finit par « bot ».
  const cubot =
    "Mozilla/5.0 (Linux; Android 11; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
  assert.equal(nEstPasUnePersonne(entetes({ "user-agent": cubot })), false);
});

test("les moteurs de recherche et les aperçus de liens ne sont pas des personnes", () => {
  for (const agent of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "WhatsApp/2.23.20.0",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
    "curl/8.4.0",
    "vercel-screenshot/1.0",
  ]) {
    assert.equal(nEstPasUnePersonne(entetes({ "user-agent": agent })), true, agent);
  }
});

test("sans agent utilisateur, ce n'est pas un navigateur", () => {
  assert.equal(nEstPasUnePersonne(entetes({})), true);
});

test("un préchargement n'est pas une page vue", () => {
  assert.equal(nEstPasUnePersonne(entetes({ "user-agent": ANDROID, "next-router-prefetch": "1" })), true);
  assert.equal(nEstPasUnePersonne(entetes({ "user-agent": IPHONE, "sec-purpose": "prefetch;prerender" })), true);
});
