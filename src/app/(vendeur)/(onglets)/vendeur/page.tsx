import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, MessageCircle, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { ScreenBody, ScreenFooter, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar } from "@/components/ui/TopBar";
import { ProductRow } from "@/components/product/ProductRow";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant, getMerchantProducts } from "@/lib/data/merchants";
import { countUnreadMessages } from "@/lib/data/messages";

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
  /* La suspension n'est plus vérifiée ici : `(vendeur)/layout.tsx` la
     traite pour TOUT l'espace, via `requireMerchantSpace`. Les quatre
     copies de cette garde — une par écran, plus une manquante sur la
     feuille d'actions produit — étaient le défaut que le découpage en
     groupes de routes vient corriger. */

  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/inscription/boutique");

  /* Le message d'erreur SUIT la redirection. Sans ces deux lignes, il
     mourait ici : une action produit qui échoue revient toujours sur
     `/vendeur?erreur=…` (voir `backToSeller`), et `/vendeur` renvoyait
     aussitôt une boutique non validée vers son écran de statut — en
     laissant le paramètre derrière lui. Le refus de la base était donc
     correct, expliqué, et invisible : l'action semblait n'avoir rien
     fait.

     Les deux écrans de destination savent déjà l'afficher avec `Notice`,
     exactement comme `/vendeur` : rien de neuf n'est inventé ici, on
     cesse seulement de perdre le message en chemin. */
  const suite = erreur ? `?erreur=${encodeURIComponent(erreur)}` : "";
  if (merchant.status === "pending") redirect(`/vendeur/attente${suite}`);
  if (merchant.status === "rejected") redirect(`/vendeur/refusee${suite}`);

  const catalogue = await getMerchantProducts(supabase, merchant);
  const published = catalogue.filter((p) => p.status === "active").length;
  const unreadCount = await countUnreadMessages(supabase, "merchant");

  return (
    <>
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

                Et il mène à `/vendeur/messages`, qui est SA messagerie.
                Ce lien pointait autrefois sur `/messages?vue=commercant` :
                le paramètre oublié, un commerçant qui a aussi un compte
                client tombait dans sa boîte d'ACHETEUR depuis sa propre
                boutique. Le chemin, lui, ne s'oublie pas. */}
            <div className="flex gap-3">
              <Card className="flex flex-1 flex-col gap-0.5 p-3.5">
                <span className="font-display text-2xl font-bold">{published}</span>
                <span className="text-xs text-ink-soft">produits publiés</span>
              </Card>
              <Link href="/vendeur/messages" className="flex-1">
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
    </>
  );
}
