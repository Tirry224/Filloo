import { NextResponse } from "next/server";
import { compter } from "@/lib/analytics";
import { getProduct } from "@/lib/data/products";
import { getMyProfile } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { lienWhatsApp } from "@/lib/telephone";

/**
 * Le détour par lequel passe chaque bouton WhatsApp : compter, puis
 * renvoyer vers `wa.me`. Sans lui, un visiteur qui préfère WhatsApp à la
 * création d'un compte disparaissait des chiffres — et le test du
 * 2026-10-06 ne pouvait pas dire si ses 4 contacts étaient perdus.
 *
 * Les liens qui mènent ici sont des `<a>` simples, JAMAIS un `<Link>` :
 * le préchargement de Next appellerait cette route au simple affichage
 * du bouton, et compterait des clics que personne n'a faits.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const product = await getProduct(supabase, id);
  const lien = product ? lienWhatsApp(product.merchant.whatsappPhone) : null;
  if (!product || !lien) return NextResponse.redirect(new URL(`/produit/${id}`, request.url));

  const client = await getMyProfile(supabase, "client");
  compter("whatsapp_ouvert", {
    productId: product.id,
    merchantId: product.merchant.id,
    role: client ? "client" : "anon",
  });

  return NextResponse.redirect(lien);
}
