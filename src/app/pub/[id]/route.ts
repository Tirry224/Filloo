import { NextResponse, type NextRequest } from "next/server";
import { compter } from "@/lib/analytics";
import { estUuid } from "@/lib/saisie";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Le clic sur une publicité (0047) : compté, puis on mène à la fiche du
 * produit ou à la boutique. La destination vient de la CAMPAGNE, jamais de
 * l'adresse : un lien `/pub/…` ne peut pas envoyer ailleurs que sur Filloo.
 * `service_role` : la campagne n'est lisible que par son commerçant et
 * l'équipe, et on ne lit que deux colonnes.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accueil = new URL("/", request.url);
  if (!estUuid(id)) return NextResponse.redirect(accueil);

  const { data } = await createAdminClient()
    .from("campagnes")
    .select("merchant_id, product_id, type, statut, debut_at, fin_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return NextResponse.redirect(accueil);

  /* Compté seulement pendant la campagne : un vieux lien, ou une campagne
     refusée, ne gonfle pas les résultats du commerçant. Il mène quand même
     à la fiche. */
  const maintenant = Date.now();
  const enLigne =
    data.statut === "active" &&
    !!data.debut_at &&
    !!data.fin_at &&
    new Date(data.debut_at).getTime() <= maintenant &&
    maintenant < new Date(data.fin_at).getTime();
  if (enLigne) await compter("pub_clic", { campagneId: id, productId: data.product_id, merchantId: data.merchant_id });
  const vers = data.type === "boutique" || !data.product_id ? `/boutique/${data.merchant_id}` : `/produit/${data.product_id}`;
  return NextResponse.redirect(new URL(vers, request.url));
}
