import { test } from "node:test";
import assert from "node:assert/strict";
import { estAdressePush } from "../src/lib/push-adresse.ts";

/**
 * Sans cette vérification, n'importe quel compte pouvait faire appeler par
 * le serveur l'adresse de son choix (audit du 2026-11-07).
 */
test("les services de push des navigateurs sont acceptés", () => {
  for (const adresse of [
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://web.push.apple.com/QGx",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ]) {
    assert.equal(estAdressePush(adresse), true, adresse);
  }
});

test("toute autre adresse est refusée", () => {
  for (const adresse of [
    "https://exemple.gn/piege",
    "http://fcm.googleapis.com/fcm/send/abc", // pas de https
    "https://fcm.googleapis.com:8443/fcm/send/abc", // port imposé
    "https://fcm.googleapis.com.exemple.gn/x", // faux sous-domaine
    "https://faux-push.apple.com.exemple.gn/x",
    "https://pushapple.com/x", // suffixe sans le point
    "https://user:pass@fcm.googleapis.com/x",
    "http://169.254.169.254/latest/meta-data",
    "pas une adresse",
    "",
    42,
    null,
  ]) {
    assert.equal(estAdressePush(adresse), false, String(adresse));
  }
});
