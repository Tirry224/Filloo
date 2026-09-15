import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BottomNav } from "@/components/ui/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";
import { getMyProfile } from "@/lib/data/session";
import { resubmitMerchantAction } from "@/lib/actions/merchants";
import { countUnreadMessages } from "@/lib/data/messages";

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
  // Même garde que /vendeur et /vendeur/boutique : la suspension vit sur
  // `profiles` et frappe les deux rôles. Sans elle, ces deux écrans
  // restaient atteignables en tapant l'adresse, et proposaient de préparer
  // des produits à quelqu'un dont chaque écriture serait écartée par le
  // RLS — une application qui a l'air de marcher et où rien ne marche.
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (merchantProfile?.isSuspended) redirect("/compte/suspendu");

  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/inscription/boutique");
  if (merchant.status === "approved") redirect("/vendeur");
  if (merchant.status === "pending") redirect("/vendeur/attente");
  const unreadCount = await countUnreadMessages(supabase, "merchant");

  return (
    <Screen>
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

      <BottomNav active="shop" space="merchant" unreadCount={unreadCount} />
    </Screen>
  );
}
