/**
 * Service worker de Makiti — NOTIFICATIONS UNIQUEMENT.
 *
 * ── Ce qu'il ne fait pas, et c'est délibéré ────────────────────────────
 *
 * Il ne met RIEN en cache. Un service worker qui garde des pages est la
 * façon la plus rapide de servir une version morte de l'application à des
 * téléphones qu'on ne peut plus joindre : la page est servie depuis le
 * cache, donc le nouveau code n'arrive jamais, donc le correctif qui
 * réparerait le cache n'arrive pas non plus. `docs/REPRISE.md` (section 5)
 * garde cette leçon, payée par la v1 du projet.
 *
 * Un service worker existe ici pour UNE raison : recevoir un push. Le
 * navigateur n'accepte pas de notification sans lui, même application
 * fermée. Tant que la mise en cache hors ligne n'est pas un chantier
 * décidé et testé, ce fichier reste à ce périmètre.
 *
 * ── Comment le désinstaller, et pourquoi c'est écrit AVANT d'en avoir
 *    besoin ──────────────────────────────────────────────────────────
 *
 * Un service worker mal retiré survit à son application. Trois recours,
 * du plus sûr au plus local :
 *
 *   1. REMPLACER LE CONTENU DE CE FICHIER par `self.registration
 *      .unregister()` et déployer. Les navigateurs revérifient `sw.js` à
 *      chaque chargement : c'est le seul moyen qui atteint TOUS les
 *      téléphones, sans rien demander à personne. C'est le bon recours.
 *   2. Ouvrir l'application avec `?sw=off` : `ServiceWorkerRegistrar`
 *      désinstalle alors au lieu d'installer. Utile pour un téléphone
 *      précis qu'on a sous la main.
 *   3. Effacer les données du site dans les réglages du navigateur.
 *
 * ── Les versions ──────────────────────────────────────────────────────
 *
 * `skipWaiting` + `clients.claim` : la nouvelle version prend la main
 * immédiatement au lieu d'attendre que tous les onglets soient fermés.
 * Sans cache, il n'y a aucun risque de mélanger deux versions d'actifs —
 * et cela garantit qu'un correctif déployé s'applique au chargement
 * suivant, pas « un jour ».
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(self.clients.claim());
});

/**
 * Un push arrive. Le serveur envoie du JSON ; on s'attend à
 * `{ titre, corps, url, tag }`, mais on ne s'y FIE pas : un push mal
 * formé ne doit pas rester silencieux, parce qu'un push reçu et non
 * affiché est un message perdu sans trace.
 */
self.addEventListener("push", (evenement) => {
  let donnees = {};
  try {
    donnees = evenement.data ? evenement.data.json() : {};
  } catch {
    donnees = {};
  }

  const titre = donnees.titre || "Makiti";
  const options = {
    body: donnees.corps || "Vous avez un nouveau message.",
    icon: "/icons/icone-192.png",
    badge: "/icons/icone-192.png",
    /* `tag` regroupe : deux messages de la même conversation remplacent
       la notification précédente au lieu d'en empiler dix. Un commerçant
       qui reçoit quinze messages veut savoir qu'on lui écrit, pas
       déverrouiller son téléphone pour vider une pile. */
    tag: donnees.tag || "makiti-message",
    renotify: true,
    data: { url: donnees.url || "/messages" },
  };

  /* `waitUntil` est obligatoire : sans lui, le navigateur peut arrêter le
     service worker avant que la notification soit affichée. Le push
     serait alors consommé pour rien — et certains navigateurs affichent à
     la place une notification générique « ce site a été mis à jour en
     arrière-plan », ce qui est pire que rien. */
  evenement.waitUntil(self.registration.showNotification(titre, options));
});

/**
 * On touche la notification : ouvrir la bonne conversation.
 *
 * On cherche d'abord un onglet Makiti DÉJÀ ouvert et on l'y amène, plutôt
 * que d'en ouvrir un deuxième — sinon la personne se retrouve avec trois
 * Makiti ouverts après trois messages.
 */
self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  const cible = (evenement.notification.data && evenement.notification.data.url) || "/messages";

  evenement.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const fenetre of fenetres) {
        if ("focus" in fenetre) {
          if ("navigate" in fenetre) fenetre.navigate(cible);
          return fenetre.focus();
        }
      }
      return self.clients.openWindow(cible);
    }),
  );
});

/**
 * Le service de push a révoqué l'abonnement (changement de navigateur,
 * nettoyage, réinstallation). Sans cet écouteur, le téléphone cesse
 * silencieusement de recevoir les notifications et personne ne le sait.
 * On se réabonne, et le serveur remplacera l'ancienne ligne.
 */
self.addEventListener("pushsubscriptionchange", (evenement) => {
  evenement.waitUntil(
    (async () => {
      const ancienne = evenement.oldSubscription || (await self.registration.pushManager.getSubscription());
      const cle = ancienne && ancienne.options && ancienne.options.applicationServerKey;
      if (!cle) return;
      const nouvelle = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cle,
      });
      await fetch("/api/push/abonnement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abonnement: nouvelle.toJSON() }),
      });
    })(),
  );
});
