import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { siteUrl, siteUrlOuLocalhost } from "../src/lib/site-url.ts";

/**
 * L'adresse du site décide où pointent les liens qui SORTENT de
 * l'application : un email de réinitialisation, un email « nouveau
 * message », une balise Open Graph, le sitemap.
 *
 * Ce qui est figé ici, c'est la conséquence d'une panne réelle : sans
 * `NEXT_PUBLIC_SITE_URL` sur l'hébergeur, AUCUN email ne partait, et rien
 * ne le disait qu'un `console.error` que personne ne lit. Le repli sur
 * `VERCEL_PROJECT_PRODUCTION_URL` est ce qui empêche cette panne de se
 * reproduire — donc il se teste.
 */

const origine = { ...process.env };
afterEach(() => {
  process.env = { ...origine };
});

test("la variable explicite gagne toujours", () => {
  // Elle est la seule à connaître un domaine propre le jour où Makiti en
  // prend un : un repli ne doit jamais la contredire.
  process.env.NEXT_PUBLIC_SITE_URL = "https://makiti.gn";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "makiti.vercel.app";
  assert.equal(siteUrl(), "https://makiti.gn");
});

test("LE FILET : sans variable explicite, l'adresse de production de Vercel prend le relais", () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "makiti.vercel.app";
  // Vercel la donne sans protocole ; c'est à nous de l'ajouter.
  assert.equal(siteUrl(), "https://makiti.vercel.app");
});

test("la barre oblique finale est retirée, des deux sources", () => {
  /* Sinon les appelants, qui concatènent un chemin commençant déjà par
     `/`, produisent `https://site.gn//produit/x` — une autre adresse pour
     un moteur de recherche. */
  process.env.NEXT_PUBLIC_SITE_URL = "https://makiti.gn///";
  assert.equal(siteUrl(), "https://makiti.gn");

  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "makiti.vercel.app/";
  assert.equal(siteUrl(), "https://makiti.vercel.app");
});

test("sans aucune source, on ne devine pas de domaine", () => {
  /* `null` est une réponse utile : `notifications.ts` renonce à l'envoi et
     le journalise, le sitemap se tait. Inventer une adresse produirait des
     liens morts dans de vrais emails. */
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  assert.equal(siteUrl(), null);
});

test("une variable vide ou blanche compte comme absente", () => {
  // Une variable posée puis vidée au tableau de bord est le cas le plus
  // courant, et « https:// » suivi de rien ne mène nulle part.
  process.env.NEXT_PUBLIC_SITE_URL = "   ";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "";
  assert.equal(siteUrl(), null);
});

test("les liens d'authentification se rabattent sur le serveur local", () => {
  /* Eux DOIVENT produire une adresse absolue même sans configuration,
     sinon on ne peut plus tester une réinitialisation de mot de passe en
     développement. */
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  assert.equal(siteUrlOuLocalhost(), "http://localhost:3000");
  assert.equal(siteUrlOuLocalhost(4000), "http://localhost:4000");
});

test("l'en-tête Host n'est plus une source", () => {
  /* Régression à empêcher : l'origine des liens de réinitialisation venait
     de `Host`, donc du CLIENT. Rien dans ce module ne doit lire une
     requête — s'il le faisait, ce test n'aurait aucun moyen de le voir,
     donc on fige au moins qu'aucune variable d'environnement d'hôte ne
     l'alimente. */
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  process.env.HOST = "faux-makiti.gn";
  process.env.VERCEL_URL = "deploiement-ephemere.vercel.app";
  assert.equal(siteUrl(), null);
});
