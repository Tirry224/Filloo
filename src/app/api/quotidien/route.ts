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
export async function GET(request: Request) {
  const refus = refusCron(request, "quotidien");
  if (refus) return refus;

  const [notifications, menage, annonces] = await Promise.allSettled([
    drainNotifications(),
    nettoyerPhotosOrphelines(),
    publierAnnoncesProgrammees(),
  ]);
  if (annonces.status === "rejected") console.error("[quotidien] annonces programmées :", annonces.reason);
  else if (annonces.value > 0) console.log(`[annonces] ${annonces.value} annonce(s) programmée(s) publiée(s).`);

  if (notifications.status === "rejected") console.error("[quotidien] notifications :", notifications.reason);
  if (menage.status === "rejected") console.error("[quotidien] ménage :", menage.reason);
  else if (menage.value.orphelines > 0) {
    console.log(`[ménage] ${menage.value.effacees}/${menage.value.orphelines} photo(s) orpheline(s) effacée(s).`);
  }

  const rapport = {
    notifications: notifications.status === "fulfilled" ? notifications.value : { erreur: "échec" },
    menage: menage.status === "fulfilled" ? menage.value : { erreur: "échec" },
    annonces: annonces.status === "fulfilled" ? { publiees: annonces.value } : { erreur: "échec" },
  };
  const toutEchoue = [notifications, menage, annonces].every((t) => t.status === "rejected");
  return NextResponse.json(rapport, { status: toutEchoue ? 500 : 200 });
}
