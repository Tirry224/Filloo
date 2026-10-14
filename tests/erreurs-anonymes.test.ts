import { test } from "node:test";
import assert from "node:assert/strict";
import { anonymiser } from "../src/lib/erreurs-anonymes.ts";

/** Telle que `@sentry/nextjs` 10.76 l'envoyait le 2026-10-14, avant filtre. */
const brute = () => ({
  message: "essai",
  user: { ip_address: "41.223.1.2" },
  breadcrumbs: [
    {
      category: "fetch",
      data: { url: "https://x.supabase.co/rest/v1/profiles", "http.query": "?phone=eq.622000000" },
    },
    { category: "console", message: "[push] échec pour fatou@exemple.gn" },
  ],
  contexts: { nextjs: { request_path: "/auth/confirm?token_hash=abc&type=recovery" } },
  request: {
    method: "GET",
    url: "https://filloo.net/auth/confirm?token_hash=abc&type=recovery",
    query_string: "token_hash=abc&type=recovery",
    cookies: { "sb-access-token": "SESSION" },
    data: "password=secret",
    headers: {
      host: "filloo.net",
      "user-agent": "Mozilla/5.0",
      Cookie: "sb-access-token=SESSION",
      authorization: "Bearer JETON",
      "x-forwarded-for": "41.223.1.2",
      "x-vercel-ip-city": "Conakry",
    },
  },
});

test("aucun secret ni donnée personnelle ne survit", () => {
  const texte = JSON.stringify(anonymiser(brute()));
  for (const fuite of ["SESSION", "JETON", "41.223", "Conakry", "token_hash", "secret", "622000000", "fatou"]) {
    assert.ok(!texte.includes(fuite), `« ${fuite} » part encore chez Sentry`);
  }
});

test("ce qui sert au diagnostic reste", () => {
  const e = anonymiser(brute());
  assert.equal(e.message, "essai");
  assert.equal(e.request.method, "GET");
  assert.equal(e.request.url, "https://filloo.net/auth/confirm");
  assert.equal(e.contexts.nextjs?.request_path, "/auth/confirm");
  assert.deepEqual(e.request.headers, { host: "filloo.net", "user-agent": "Mozilla/5.0" });
});

test("un événement sans requête passe tel quel", () => {
  const cron: { message: string; request?: undefined } = { message: "cron" };
  assert.deepEqual(anonymiser(cron), { message: "cron" });
});
