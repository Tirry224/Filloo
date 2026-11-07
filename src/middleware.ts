import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { COOKIE_VISITEUR, DUREE_COOKIE_VISITEUR, lireVisiteur } from "@/lib/visiteur";

export async function middleware(request: NextRequest) {
  /* Le cookie de mesure (`lib/visiteur.ts`) : posé sur la REQUÊTE aussi,
     pour que la toute première page vue compte déjà ce visiteur —
     `updateSession` transmet la requête ainsi modifiée au serveur. */
  const nouveau = lireVisiteur(request.cookies.get(COOKIE_VISITEUR)?.value) ? null : crypto.randomUUID();
  if (nouveau) request.cookies.set(COOKIE_VISITEUR, nouveau);

  const response = await updateSession(request);

  if (nouveau) {
    response.cookies.set(COOKIE_VISITEUR, nouveau, {
      maxAge: DUREE_COOKIE_VISITEUR,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
