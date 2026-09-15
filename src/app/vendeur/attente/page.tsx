import { redirect } from "next/navigation";
import { Clock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BottomNav } from "@/components/ui/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { StepList } from "@/components/ui/StepList";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";
import { getMyProfile } from "@/lib/data/session";
import { countUnreadMessages } from "@/lib/data/messages";

/**
 * Écran 20 — boutique en cours de vérification.
 *
 * L'écran donne une TÂCHE au lieu de faire patienter. Un commerçant qui
 * attend 48 heures devant une page inerte ne revient pas ; un commerçant
 * qui a préparé quatre brouillons a déjà investi quelque chose.
 */
export default async function PendingShopPage() {
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
  if (merchant.status === "rejected") redirect("/vendeur/refusee");
  const unreadCount = await countUnreadMessages(supabase, "merchant");

  return (
    <Screen>
      <TopBar title={<Wordmark />} right={<Badge tone="warn">En attente</Badge>} />

      <ScreenBody>
        <Section className="gap-5 py-6">
          <div className="flex flex-col gap-2.5">
            <div className="flex size-14 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Clock size={28} strokeWidth={1.8} aria-hidden />
            </div>
            <h1 className="text-2xl font-bold">Votre boutique est en cours de vérification</h1>
            <p className="text-base leading-relaxed text-ink-soft">
              Nous vérifions les informations de <b className="text-ink">{merchant.shopName}</b> sous
              48 heures. Vous recevrez un email dès qu&apos;elle sera validée.
            </p>
          </div>

          <Card padded>
            <StepList
              steps={[
                { label: "Informations de la boutique", state: "done" },
                { label: "Vérification par notre équipe", state: "current" },
                { label: "Publication de vos produits", state: "todo" },
              ]}
            />
          </Card>

          <div className="flex flex-col gap-2 rounded-xl bg-success-soft p-4">
            <span className="text-base font-bold">Ne perdez pas de temps</span>
            <p className="text-sm leading-normal text-success-ink">
              Préparez vos produits dès maintenant. Ils resteront en brouillon et seront publiés
              en un clic dès la validation.
            </p>
          </div>

          <Button icon={Plus} href="/vendeur/produits/nouveau">
            Préparer un produit
          </Button>
        </Section>
      </ScreenBody>

      <BottomNav active="shop" space="merchant" unreadCount={unreadCount} />
    </Screen>
  );
}
