import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ReportForm } from "@/components/product/ReportForm";
import { reportReasons } from "@/lib/mock";
import { createClient } from "@/lib/supabase/server";
import { getProduct } from "@/lib/data/products";
import { getMyProfiles } from "@/lib/data/session";

/**
 * Écran 10 — signaler un produit. Le catalogue est ouvert sans compte,
 * mais signaler ÉCRIT en base ("reports: je signale" exige un profil
 * actif) : un visiteur non connecté voit une invite à se connecter plutôt
 * que le formulaire, qui échouerait de toute façon côté RLS.
 */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const product = await getProduct(supabase, id);
  if (!product) notFound();

  const profiles = await getMyProfiles(supabase);
  const canReport = profiles.some((p) => !p.isSuspended && !p.isDeleted);

  return (
    <Sheet
      title="Signaler ce produit"
      description="Votre signalement est envoyé à l'équipe Makiti. Le vendeur n'est pas prévenu."
      closeHref={`/produit/${product.id}`}
    >
      {canReport ? (
        <ReportForm productId={product.id} reasons={reportReasons} />
      ) : (
        <>
          <p className="text-sm text-ink-soft">Connectez-vous pour signaler ce produit.</p>
          <Button href="/inscription">Créer mon compte</Button>
          <Button variant="secondary" size="sm" href="/connexion">
            J&apos;ai déjà un compte
          </Button>
        </>
      )}
    </Sheet>
  );
}
