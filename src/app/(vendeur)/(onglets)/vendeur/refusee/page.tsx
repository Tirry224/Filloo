import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";
import { resubmitMerchantAction } from "@/lib/actions/merchants";

/**
 * Le motif vient de `merchants.rejection_reason` ; la base permet encore
 * un refus sans motif, d'où le texte de repli.
 */
export default async function RejectedShopPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const supabase = await createClient();
  // La suspension est traitée par `(vendeur)/layout.tsx` pour TOUT
  // l'espace, via `requireMerchantSpace`.

  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/inscription/boutique");
  if (merchant.status === "approved") redirect("/vendeur");
  if (merchant.status === "pending") redirect("/vendeur/attente");

  return (
    <TabScreen largeur="rangees">
      <TopBar title={<Wordmark />} right={<Badge tone="danger">Refusée</Badge>} />

      <ScreenBody>
        {erreur ? <Notice>{erreur}</Notice> : null}
        <Section className="gap-5 py-6">
          <div className="flex size-14 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <X size={28} strokeWidth={2.2} aria-hidden />
          </div>

          <div className="flex flex-col gap-2.5">
            <h1 className="text-2xl font-bold">Votre boutique n&apos;a pas été validée</h1>
            <p className="text-base leading-relaxed text-ink-soft">
              {merchant.rejectionReason ?? "Aucun motif n'a été renseigné par notre équipe."}
            </p>
          </div>

          <Card padded className="flex flex-col gap-2">
            <span className="text-base font-bold">Ce que vous pouvez faire</span>
            <p className="text-sm leading-relaxed text-ink-soft">
              Vérifiez votre numéro, corrigez-le si nécessaire, puis renvoyez votre boutique.
              Vos produits en brouillon sont conservés.
            </p>
          </Card>

          <Button href="/vendeur/boutique">Corriger ma boutique</Button>
          <form action={resubmitMerchantAction}>
            <Button type="submit" variant="secondary">
              Renvoyer ma boutique à la vérification
            </Button>
          </form>
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}
