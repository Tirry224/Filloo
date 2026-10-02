import { redirect } from "next/navigation";
import { Clock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { StepList } from "@/components/ui/StepList";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant } from "@/lib/data/merchants";

export default async function PendingShopPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; info?: string }>;
}) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();
  // La suspension est traitée par `(vendeur)/layout.tsx` pour TOUT
  // l'espace, via `requireMerchantSpace`.

  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/inscription/boutique");
  if (merchant.status === "approved") redirect("/vendeur");
  if (merchant.status === "rejected") redirect("/vendeur/refusee");

  return (
    <TabScreen largeur="rangees">
      <TopBar title={<Wordmark />} right={<Badge tone="warn">En attente</Badge>} />

      <ScreenBody>
        {erreur ? <Notice>{erreur}</Notice> : null}
        {info ? <Notice tone="success">{info}</Notice> : null}
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
    </TabScreen>
  );
}
