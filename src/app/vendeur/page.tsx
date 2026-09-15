import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, MessageCircle, Plus, User } from "lucide-react";
import { BottomNav } from "@/components/ui/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody, ScreenFooter, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { ProductRow } from "@/components/product/ProductRow";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/data/session";
import { getMyMerchant, getMerchantProducts } from "@/lib/data/merchants";
import { countUnreadMessages } from "@/lib/data/messages";
import { messagesHref } from "@/lib/space";

/**
 * Mes produits — écrans 22 et 23 de docs/ECRANS.md.
 *
 * Cette page ne se contente pas d'afficher : elle aiguille. Une boutique
 * sans compte va s'inscrire, une boutique en attente ou refusée va voir
 * l'écran qui explique pourquoi — voir `/vendeur/attente` et
 * `/vendeur/refusee`. Seule une boutique approuvée voit son catalogue.
 */
export default async function SellerPage({
  searchParams,
}: {
  /* `erreur` est posé par les actions de `src/lib/actions/products.ts`
     quand l'une d'elles échoue : elles redirigent ici plutôt que de se
     taire. Voir `Notice` pour pourquoi le message passe par l'URL. */
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const supabase = await createClient();
  // La suspension n'était vérifiée QUE sur /compte. Un commerçant suspendu
  // voyait donc son espace normal, où chaque écriture échouait en silence
  // (la policy « products: je gere mes produits » exige
  // `is_active_profile`, et un `update` écarté répond un succès à zéro
  // ligne). Une application qui a l'air de marcher et où rien ne marche
  // est le pire des deux mondes : la personne réessaie au lieu de
  // comprendre. Trouvé le 2026-09-13 en balayant les symétries.
  const merchantProfile = await getMyProfile(supabase, "merchant");
  if (merchantProfile?.isSuspended) redirect("/compte/suspendu");

  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/inscription/boutique");
  if (merchant.status === "pending") redirect("/vendeur/attente");
  if (merchant.status === "rejected") redirect("/vendeur/refusee");

  const catalogue = await getMerchantProducts(supabase, merchant);
  const published = catalogue.filter((p) => p.status === "active").length;
  const unreadCount = await countUnreadMessages(supabase, "merchant");

  return (
    <Screen>
      <TopBar
        title={
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-lg font-bold">{merchant.shopName}</span>
            <span className="flex items-center gap-1 text-2xs font-semibold text-success">
              <Check size={13} strokeWidth={2.8} aria-hidden />
              Boutique validée
            </span>
          </div>
        }
        right={
          <Link href="/vendeur/boutique" aria-label="Modifier ma boutique">
            <User size={20} strokeWidth={1.8} className="text-ink-soft" />
          </Link>
        }
      />

      <ScreenBody>
        {erreur ? <Notice>{erreur}</Notice> : null}

        {catalogue.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="Votre boutique est vide"
            description="Un premier produit avec une photo nette et un prix clair suffit pour recevoir vos premiers messages."
          >
            <Button href="/vendeur/produits/nouveau">Ajouter mon premier produit</Button>
          </EmptyState>
        ) : (
          <Section className="gap-3.5">
            {/* Deux chiffres, pas six — comme l'écran 22 le demande
                (« publiés, messages non lus »). Le second manquait :
                `countUnreadMessages` le calcule désormais depuis la vraie
                base, donc le lien honnête peut redevenir un chiffre.

                Et il mène à `/messages?vue=commercant`, pas à `/messages`
                nu : un commerçant qui a aussi un compte client tombait
                sinon dans sa boîte d'ACHETEUR depuis sa propre boutique. */}
            <div className="flex gap-3">
              <Card className="flex flex-1 flex-col gap-0.5 p-3.5">
                <span className="font-display text-2xl font-bold">{published}</span>
                <span className="text-xs text-ink-soft">produits publiés</span>
              </Card>
              <Link href={messagesHref("merchant")} className="flex-1">
                <Card className="flex h-full flex-col items-start justify-center gap-1 border-accent bg-accent-soft p-3.5">
                  <MessageCircle size={20} strokeWidth={1.9} className="text-accent-hover" aria-hidden />
                  <span className="font-display text-2xl font-bold text-accent-hover">{unreadCount}</span>
                  <span className="text-xs font-medium text-accent-hover">
                    message{unreadCount > 1 ? "s" : ""} non lu{unreadCount > 1 ? "s" : ""}
                  </span>
                </Card>
              </Link>
            </div>

            <SectionLabel>Mes produits</SectionLabel>
            <div className="flex flex-col gap-2.5">
              {catalogue.map((p) => (
                <Link key={p.id} href={`/vendeur/produits/${p.id}/actions`}>
                  <ProductRow product={p} />
                </Link>
              ))}
            </div>
          </Section>
        )}
      </ScreenBody>

      {catalogue.length > 0 ? (
        <ScreenFooter>
          <Button icon={Plus} href="/vendeur/produits/nouveau">
            Ajouter un produit
          </Button>
        </ScreenFooter>
      ) : null}

      <BottomNav active="shop" space="merchant" unreadCount={unreadCount} />
    </Screen>
  );
}
