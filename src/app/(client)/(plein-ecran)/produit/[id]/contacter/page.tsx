import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Photo } from "@/components/ui/Photo";
import { PriceTag } from "@/components/product/PriceTag";
import { Sheet } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/server";
import { getProduct } from "@/lib/data/products";
import { getMyProfile } from "@/lib/data/session";
import { getMyMerchant } from "@/lib/data/merchants";
import { findOrCreateConversation } from "@/lib/actions/messages";
import { compter } from "@/lib/analytics";
import { lienWhatsApp } from "@/lib/telephone";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const product = await getProduct(supabase, id);
  if (!product) notFound();

  const waHref = lienWhatsApp(product.merchant.whatsappPhone);

  const clientProfile = await getMyProfile(supabase, "client");

  /* On ne se contacte pas soi-même : avec les deux comptes liés (décision
     8), ouvrir un fil avec sa propre boutique incrémenterait
     `bump_contact_count` (0002, 3.3), donc monterait ses propres produits
     dans le tri « populaires ». La base refuse l'insertion (0016) ; ici on
     évite seulement que ce refus se présente comme une panne.

     espaces:autorise — le départ vers `/vendeur` est déclenché par la
     personne sur son propre produit, et la réponse utile à son geste
     n'existe que dans son espace commerçant. */
  const myMerchant = await getMyMerchant(supabase);
  if (myMerchant && myMerchant.id === product.merchant.id) {
    redirect(`/vendeur/produits/${product.id}/actions`);
  }

  /* Sans cet arrêt, un client suspendu atteint `findOrCreateConversation`,
     que le RLS refuse (`is_active_profile`), et lit « Vérifiez votre
     connexion » : il croit son réseau coupé et réessaie, sans jamais voir
     /compte/suspendu qui existe pour le lui dire. */
  if (clientProfile?.isSuspended) redirect("/compte/suspendu");

  /* Un refus de la base n'est pas une panne : le seul possible ici est le
     quota de 20 nouvelles conversations par jour (décision 13). Affiché en
     « Vérifiez votre connexion », il ferait réessayer toute la journée un
     geste refusé. Aucune conversation n'est créée, le trigger précédant
     l'insertion (0002, 3.4). */
  compter("contact_ouvert", {
    productId: product.id,
    merchantId: product.merchant.id,
    role: clientProfile ? "client" : "anon",
  });

  const outcome = clientProfile
    ? await findOrCreateConversation(supabase, clientProfile.id, product.merchant.id)
    : null;
  if (outcome?.kind === "ready") {
    redirect(`/messages/${outcome.conversationId}?produit=${product.id}`);
  }

  if (outcome?.kind === "refused") {
    return (
      <Sheet
        title="Vous avez contacté beaucoup de vendeurs aujourd'hui"
        description={outcome.reason}
        closeHref={`/produit/${product.id}`}
      >
        <Button href="/messages">Voir mes conversations</Button>
        <Button variant="secondary" size="sm" href={`/produit/${product.id}`}>
          Revenir au produit
        </Button>
        {waHref ? (
          <a
            href={waHref}
            className="text-center text-xs text-ink-soft underline underline-offset-2"
          >
            Ou appelez directement le vendeur sur WhatsApp.
          </a>
        ) : null}
      </Sheet>
    );
  }

  const next = encodeURIComponent(`/produit/${product.id}/contacter`);

  return (
    <Sheet
      title="Créez un compte pour écrire"
      description="Le vendeur a besoin de savoir qui le contacte. La création du compte prend moins d'une minute, et vous gardez l'accès à vos échanges."
      closeHref={`/produit/${product.id}`}
    >
      <Card className="flex items-center gap-2.5 p-2.5">
        <Photo ratio="free" className="size-11 shrink-0 rounded-md" iconSize={18} />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">{product.title}</span>
          <PriceTag amount={product.priceGnf} size="sm" />
        </div>
      </Card>
      <Button href={`/inscription?next=${next}`}>Créer mon compte</Button>
      <Button variant="secondary" size="sm" href={`/connexion?next=${next}`}>
        J&apos;ai déjà un compte
      </Button>
      {waHref ? (
        <a
          href={waHref}
          className="text-center text-xs text-ink-soft underline underline-offset-2"
        >
          Ou appelez directement le vendeur sur WhatsApp.
        </a>
      ) : null}
    </Sheet>
  );
}
