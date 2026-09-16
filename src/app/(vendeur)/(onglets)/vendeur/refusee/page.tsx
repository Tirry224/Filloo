import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";
import { resubmitMerchantAction } from "@/lib/actions/merchants";

/**
 * Écran 21 — boutique refusée.
 *
 * Un refus sans motif est un vendeur perdu définitivement. L'écran dit
 * POURQUOI, dit CE QU'IL FAUT FAIRE, et rassure sur ce qui est conservé.
 * Le motif vient de `merchants.rejection_reason` (voir docs/REPRISE.md,
 * section 4) : un refus sans motif reste possible côté base (contrainte
 * pas encore posée), d'où le texte de repli ci-dessous.
 */
export default async function RejectedShopPage({
  searchParams,
}: {
  /* `erreur` est posé par `resubmitMerchantAction` quand la base refuse le
     renvoi — même canal que les actions produit vers `/vendeur`. */
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const supabase = await createClient();
  /* La suspension n'est plus vérifiée ici : `(vendeur)/layout.tsx` la
     traite pour TOUT l'espace, via `requireMerchantSpace`. Les quatre
     copies de cette garde — une par écran, plus une manquante sur la
     feuille d'actions produit — étaient le défaut que le découpage en
     groupes de routes vient corriger. */

  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/inscription/boutique");
  if (merchant.status === "approved") redirect("/vendeur");
  if (merchant.status === "pending") redirect("/vendeur/attente");

  return (
    <>
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

          {/* Deux gestes, et le second manquait entièrement. Cet écran
              annonçait « puis renvoyez votre boutique » sans offrir nulle
              part de quoi le faire : corriger ses informations ne changeait
              pas `merchants.status`, donc la boutique restait refusée quoi
              qu'on corrige, et le commerçant tournait entre ces deux écrans
              sans jamais repartir vers la vérification.

              L'ordre compte : on corrige D'ABORD, on renvoie ENSUITE. Le
              renvoi est donc le bouton secondaire — renvoyer sans rien
              changer ferait refuser la boutique une seconde fois. */}
          <Button href="/vendeur/boutique">Corriger ma boutique</Button>
          <form action={resubmitMerchantAction}>
            <Button type="submit" variant="secondary">
              Renvoyer ma boutique à la vérification
            </Button>
          </form>
        </Section>
      </ScreenBody>
    </>
  );
}
