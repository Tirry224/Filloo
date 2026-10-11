import { NextResponse } from "next/server";
import { ecrireMesInformations, lireInformations } from "@/lib/ecritures-protegees";
import { messagePourErreur } from "@/lib/erreurs";
import { verifierJetonEtMotDePasse } from "@/lib/requete-app";

/**
 * « Mes informations » depuis l'APP MOBILE : nom et téléphone de la
 * connexion. Depuis 0037 l'app ne peut plus les écrire elle-même ; le
 * site le fait pour elle, après le jeton ET le mot de passe, avec les
 * mêmes contrôles que `updateProfileAction`.
 *
 * Corps : `{ motDePasse, fullName, phone }`. Un refus de saisie répond
 * 422 avec un `message` à afficher tel quel. La ville du client reste
 * écrite par l'app : elle n'est pas protégée par le mot de passe.
 */
export async function POST(request: Request) {
  const verifie = await verifierJetonEtMotDePasse(request);
  if (verifie instanceof NextResponse) return verifie;
  const { user, corps } = verifie;

  const informations = lireInformations((champ) => corps[champ]);
  if ("error" in informations) return NextResponse.json({ message: informations.error }, { status: 422 });

  const { data: ecrits, error } = await ecrireMesInformations(user.id, informations.fullName, informations.phone);
  if (error) return NextResponse.json({ message: messagePourErreur(error, "compte app") }, { status: 422 });
  if (!ecrits) return NextResponse.json({ erreur: "rien d'enregistré" }, { status: 409 });
  return NextResponse.json({ enregistre: true });
}
