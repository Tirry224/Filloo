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
 * Mes produits — écran 22 de docs/ECRANS.md, devenu un onglet à part.
 *
 * POURQUOI CETTE LISTE A QUITTÉ `/vendeur`
 * Elle y cohabitait avec les chiffres d'activité, et les deux s'y
 * gênaient : les cartes de statistiques repoussaient le catalogue vers le
 * bas de l'écran, et un catalogue de trente produits noyait les chiffres
 * qu'on venait consulter. Ce sont deux gestes différents — regarder où
 * l'on en est, et tenir son stock — qui méritaient deux écrans, comme le
 * prototype le prévoyait depuis le début.
 *
 * LE BOUTON « AJOUTER » EST EN HAUT, PAS EN BAS
 * Il vivait dans un `ScreenFooter` collé au bas de l'écran. Sur une liste
 * longue, ce pied de page recouvre en permanence le dernier produit — et
 * c'est justement celui qu'on vient de créer. En tête de barre, il ne
 * masque rien et reste atteignable sans dérouler.
 */
export default async function MerchantProductsPage({
  searchParams,
}: {
  /* Même canal que les autres écrans de l'espace : une action produit qui
     échoue redirige en portant son message dans l'URL (voir `Notice`). */
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const supabase = await createClient();

  /* La garde de rôle et la suspension sont traitées par
     `(vendeur)/layout.tsx` pour tout l'espace. Ne reste ici que ce que ce
     layout laisse volontairement passer : un profil commerçant tout neuf,
     qui n'a pas encore de boutique. */
  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/inscription/boutique");

  /* Une boutique non validée n'a pas sa place dans les onglets de gestion :
     `/vendeur/attente` et `/vendeur/refusee` sont ses écrans. On reprend
     l'aiguillage de `/vendeur`, en portant le message d'erreur avec lui —
     sans ces lignes, il mourrait ici. */
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
