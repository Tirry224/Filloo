import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ProductRow } from "@/components/product/ProductRow";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant, getMerchantProducts } from "@/lib/data/merchants";

/**
 * Mes produits — écran 22 de docs/ECRANS.md, onglet à part de `/vendeur` :
 * deux gestes distincts, voir où l'on en est et tenir son stock, donc deux
 * écrans.
 *
 * Le bouton « Ajouter » est EN HAUT : dans un `ScreenFooter`, il recouvre
 * le dernier produit de la liste, justement celui qu'on vient de créer.
 */
export default async function MerchantProductsPage({
  searchParams,
}: {
  // Même canal que le reste de l'espace : le message d'erreur voyage dans
  // l'URL (voir `Notice`).
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const supabase = await createClient();

  // Rôle et suspension sont traités par `(vendeur)/layout.tsx` ; ne reste
  // ici que le profil commerçant qui n'a pas encore de boutique.
  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/inscription/boutique");

  /* Une boutique non validée n'a pas sa place dans les onglets de gestion :
     `/vendeur/attente` et `/vendeur/refusee` sont ses écrans. Le message
     d'erreur voyage avec la redirection, sinon il meurt ici. */
  const suite = erreur ? `?erreur=${encodeURIComponent(erreur)}` : "";
  if (merchant.status === "pending") redirect(`/vendeur/attente${suite}`);
  if (merchant.status === "rejected") redirect(`/vendeur/refusee${suite}`);

  const catalogue = await getMerchantProducts(supabase, merchant);

  return (
    <>
      <TopBar
        title="Mes produits"
        right={
          <Link
            href="/vendeur/produits/nouveau"
            className="flex items-center gap-1 text-base font-semibold text-accent"
          >
            <Plus size={18} strokeWidth={2.4} aria-hidden />
            Ajouter
          </Link>
        }
      />

      <ScreenBody rangees>
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
          <Section className="gap-2.5">
            {catalogue.map((p) => (
              <Link key={p.id} href={`/vendeur/produits/${p.id}/actions`}>
                <ProductRow product={p} />
              </Link>
            ))}
          </Section>
        )}
      </ScreenBody>
    </>
  );
}
