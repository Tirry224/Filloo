import { NextResponse } from "next/server";
import { CHEMIN_PHOTO, ecrireMaBoutique, lireBoutique } from "@/lib/ecritures-protegees";
import { messagePourErreur } from "@/lib/erreurs";
import { verifierJetonEtMotDePasse } from "@/lib/requete-app";

/**
 * « Modifier ma boutique » depuis l'APP MOBILE. Depuis 0037 l'app ne peut
 * plus écrire sa boutique elle-même ; le site le fait pour elle, après le
 * jeton ET le mot de passe, avec les mêmes contrôles que
 * `updateMerchantAction`.
 *
 * Corps : `{ motDePasse, shopName, cityId, addressHint, whatsappPhone,
 * description, photoPath }`. Un refus de saisie répond 422 avec un
 * `message` à afficher tel quel ; la réponse rend l'id de la boutique.
 * Le ménage des anciennes photos reste fait par l'app (stockage, RLS).
 */
export async function POST(request: Request) {
  const verifie = await verifierJetonEtMotDePasse(request);
  if (verifie instanceof NextResponse) return verifie;
  const { user, corps } = verifie;

  const lu = lireBoutique((champ) => corps[champ]);
  if ("error" in lu) return NextResponse.json({ message: lu.error }, { status: 422 });
  const photoPath = typeof corps.photoPath === "string" ? corps.photoPath : "";
  if (photoPath && !CHEMIN_PHOTO.test(photoPath)) {
    return NextResponse.json({ message: "Photo invalide. Choisissez-la de nouveau." }, { status: 422 });
  }

  const { data: boutiqueId, error } = await ecrireMaBoutique(user.id, lu, photoPath);
  if (error) return NextResponse.json({ message: messagePourErreur(error, "boutique app") }, { status: 422 });
  if (!boutiqueId) return NextResponse.json({ erreur: "rien d'enregistré" }, { status: 409 });
  return NextResponse.json({ boutiqueId });
}
