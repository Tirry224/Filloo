import { cookies } from "next/headers";
import { COOKIE_GOUTS, lireGouts, type Gouts } from "@/lib/gouts";

/** Les goûts de l'appareil qui demande la page, lus et aussitôt oubliés (jamais en base). */
export async function goutsDeLaRequete(): Promise<Gouts> {
  return lireGouts((await cookies()).get(COOKIE_GOUTS)?.value);
}
