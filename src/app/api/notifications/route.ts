import { NextResponse } from "next/server";
import { drainNotifications } from "@/lib/notifications-decisions";

/**
 * Le balayage des notifications en attente (migration `0021`).
 *
 * Appelée par Vercel Cron, qui joint l'en-tête
 * `Authorization: Bearer $CRON_SECRET`. C'est la seule façon d'entrer :
 * cette adresse lit `auth.users` et envoie des emails, donc l'ouvrir au
 * public reviendrait à offrir un robinet à courrier.
 *
 * POURQUOI UNE ROUTE, ET PAS UNE TÂCHE PLANIFIÉE DANS LA BASE
 * Le code d'envoi vit déjà ici (`src/lib/email.ts`), avec la clé Resend
 * dans les variables d'environnement Vercel. Le déplacer en base
 * demanderait l'extension `pg_net`, la clé recopiée dans Postgres, et un
 * deuxième endroit où lire les journaux. Une route change de rien : elle
 * réutilise le transport qui envoie déjà les notifications de message.
 *
 * `GET` parce que Vercel Cron n'émet que des `GET`. Ce n'est pas une
 * lecture — la route écrit — mais l'appelant est unique, authentifié, et
 * l'opération est idempotente au sens qui compte ici : rejouée, elle ne
 * renvoie pas ce qui est déjà marqué.
 */

/* PAS de `export const dynamic = "force-dynamic"` ici, bien que ce soit
   le réflexe : depuis Next 15 RC, un handler `GET` est dynamique PAR
   DÉFAUT (voir la table « Version History » de
   `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`),
   et lire un en-tête le rendrait dynamique de toute façon. L'option est
   par ailleurs en cours de retrait en 16 dès que Cache Components est
   activé. Une ligne qui ne fait rien aujourd'hui est une ligne qui
   cassera le jour où on activera l'option. */

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  /* Pas de secret posé = la route est FERMÉE, jamais ouverte. Le défaut
     d'une protection doit être le refus : une variable oubliée lors d'un
     déploiement exposerait sinon l'envoi d'emails à qui connaît
     l'adresse. */
  if (!secret) {
    console.error("[notifications] CRON_SECRET absente : balayage refusé.");
    return NextResponse.json({ erreur: "non configurée" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    /* 404 et non 401 : une adresse qui répond « mauvais mot de passe »
       confirme à un inconnu qu'elle existe et qu'elle vaut la peine
       d'être forcée. Celle-ci n'a aucune raison d'être trouvable. */
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }

  try {
    const rapport = await drainNotifications();

    /* Le rapport part dans les journaux Vercel, parce que c'est le seul
       endroit où l'on constatera qu'un envoi coince. Personne ne regarde
       la réponse d'un cron. */
    if (!rapport.configuree) {
      console.warn("[notifications] ni Resend ni les clés VAPID : rien n'a été envoyé.");
    } else if (rapport.echouees > 0) {
      console.error(`[notifications] ${rapport.echouees} envoi(s) en échec — voir la table notifications.`);
    } else if (rapport.envoyees > 0) {
      console.log(
        `[notifications] ${rapport.envoyees} décision(s) annoncée(s), dont ${rapport.poussees} sur un appareil.`,
      );
    }

    return NextResponse.json(rapport);
  } catch (cause) {
    /* Une exception ici n'empêche personne d'utiliser l'application :
       les lignes non marquées restent en attente et le passage suivant
       les reprendra. On la journalise et on rend un 500, qui fait
       apparaître le cron en échec dans le tableau de bord Vercel — c'est
       précisément le signal qu'on veut. */
    console.error("[notifications] balayage impossible :", cause);
    return NextResponse.json({ erreur: "balayage impossible" }, { status: 500 });
  }
}
