import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { drainNotifications } from "@/lib/notifications-decisions";
import { nettoyerPhotosOrphelines } from "@/lib/menage";
import { refusCron } from "@/lib/cron";
import { publierAnnoncesProgrammees } from "@/lib/notifications-equipe";

/**
 * Le passage du matin de Vercel Cron (`vercel.json`, 7 h UTC = 7 h à
 * Conakry) : annoncer les décisions d'administration, effacer les photos
 * orphelines, et publier les annonces programmées pour aujourd'hui (0045).
 *
 * UNE route pour les deux, et donc un seul cron : la documentation
 * Vercel ne dit pas combien de crons l'offre gratuite autorise, et un
 * `vercel.json` qui en déclare trop fait échouer le déploiement.
 *
 * Chaque tâche est isolée : une panne de l'une n'empêche pas l'autre. La
 * purge des mesures, elle, tourne dans la base (pg_cron, 0028).
 */
/** Le délai avant la seconde tentative d'une tâche qui a échoué. */
const ATTENTE_AVANT_REESSAI_MS = 5_000;

/**
 * Une tâche, réessayée UNE fois après quelques secondes. Sans risque de
 * doublon : les trois tâches travaillent sur une file (notifications non
 * envoyées, photos orphelines, annonces dont la date est passée,
 * `<= current_date`) et un second passage ne reprend que ce que le premier
 * n'a pas fini. Un jour manqué se rattrape de même au passage suivant.
 *
 * Pourquoi réessayer : l'audit du 2026-11-07 rapportait des échecs « JWT
 * issued at future », non reproduits depuis (journaux Vercel Hobby
 * gardés une heure). Ce message vient d'une horloge en avance de quelques
 * secondes sur celle qui vérifie le jeton : une seconde tentative passe.
 */
async function avecReessai<T>(nom: string, tache: () => Promise<T>): Promise<T> {
  try {
    return await tache();
  } catch (premiere) {
    console.warn(`[quotidien] ${nom} : échec, nouvel essai dans ${ATTENTE_AVANT_REESSAI_MS / 1000} s :`, messageDe(premiere));
    await new Promise((r) => setTimeout(r, ATTENTE_AVANT_REESSAI_MS));
    return tache();
  }
}

function messageDe(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === "object" && "message" in cause) return String((cause as { message: unknown }).message);
  return String(cause);
}

/**
 * Une tâche qui échoue deux fois part dans Sentry (2026-11-07) : avant, elle
 * n'écrivait qu'un `console.error`, lu par personne, dans des journaux que
 * Vercel Hobby efface au bout d'une heure. Les erreurs de Supabase ne sont
 * pas des `Error` : on les enveloppe pour garder une pile et un titre lisible.
 */
function signaler(nom: string, cause: unknown): void {
  console.error(`[quotidien] ${nom} :`, cause);
  const erreur = cause instanceof Error ? cause : new Error(messageDe(cause));
  Sentry.captureException(erreur, { tags: { cron: "quotidien", tache: nom } });
}

export async function GET(request: Request) {
  const refus = refusCron(request, "quotidien");
  if (refus) return refus;

  const [notifications, menage, annonces] = await Promise.allSettled([
    avecReessai("notifications", drainNotifications),
    avecReessai("ménage", nettoyerPhotosOrphelines),
    avecReessai("annonces programmées", publierAnnoncesProgrammees),
  ]);
  if (annonces.status === "rejected") signaler("annonces programmées", annonces.reason);
  else if (annonces.value > 0) console.log(`[annonces] ${annonces.value} annonce(s) programmée(s) publiée(s).`);

  if (notifications.status === "rejected") signaler("notifications", notifications.reason);
  if (menage.status === "rejected") signaler("ménage", menage.reason);
  else if (menage.value.orphelines > 0) {
    console.log(`[ménage] ${menage.value.effacees}/${menage.value.orphelines} photo(s) orpheline(s) effacée(s).`);
  }

  const rapport = {
    notifications: notifications.status === "fulfilled" ? notifications.value : { erreur: "échec" },
    menage: menage.status === "fulfilled" ? menage.value : { erreur: "échec" },
    annonces: annonces.status === "fulfilled" ? { publiees: annonces.value } : { erreur: "échec" },
  };
  /* 500 dès qu'UNE tâche échoue (avant : seulement si les trois échouaient) :
     l'onglet Cron de Vercel montre alors l'échec au lieu d'un vert trompeur. */
  const unEchec = [notifications, menage, annonces].some((t) => t.status === "rejected");
  if (unEchec) await Sentry.flush(2_000);
  return NextResponse.json(rapport, { status: unEchec ? 500 : 200 });
}
