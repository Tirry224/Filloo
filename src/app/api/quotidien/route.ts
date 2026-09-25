import { NextResponse } from "next/server";
import { drainNotifications } from "@/lib/notifications-decisions";
import { nettoyerPhotosOrphelines } from "@/lib/menage";
import { refusCron } from "@/lib/cron";

/**
 * Le passage du matin de Vercel Cron (`vercel.json`) : annoncer les
 * décisions d'administration, puis effacer les photos orphelines.
 *
 * UNE route pour les deux, et donc un seul cron : la documentation
 * Vercel ne dit pas combien de crons l'offre gratuite autorise, et un
 * `vercel.json` qui en déclare trop fait échouer le déploiement.
 *
 * Chaque tâche est isolée : une panne de l'une n'empêche pas l'autre. La
 * purge des mesures, elle, tourne dans la base (pg_cron, 0028).
 */
export async function GET(request: Request) {
  const refus = refusCron(request, "quotidien");
  if (refus) return refus;

  const [notifications, menage] = await Promise.allSettled([drainNotifications(), nettoyerPhotosOrphelines()]);

  if (notifications.status === "rejected") console.error("[quotidien] notifications :", notifications.reason);
  if (menage.status === "rejected") console.error("[quotidien] ménage :", menage.reason);
  else if (menage.value.orphelines > 0) {
    console.log(`[ménage] ${menage.value.effacees}/${menage.value.orphelines} photo(s) orpheline(s) effacée(s).`);
  }

  const rapport = {
    notifications: notifications.status === "fulfilled" ? notifications.value : { erreur: "échec" },
    menage: menage.status === "fulfilled" ? menage.value : { erreur: "échec" },
  };
  const toutEchoue = notifications.status === "rejected" && menage.status === "rejected";
  return NextResponse.json(rapport, { status: toutEchoue ? 500 : 200 });
}
