import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ProductRow } from "@/components/product/ProductRow";
import { createClient } from "@/lib/supabase/server";
import { getMyMerchant, getMerchantProducts } from "@/lib/data/merchants";
import { cn } from "@/lib/cn";
import { ficheIncomplete } from "@/lib/mode";
import { premier } from "@/lib/next-param";
import type { Product } from "@/lib/types";

/**
 * Les articles rangés en onglets (2026-11-10, « améliorer le côté
 * commerce ») : le commerçant voit d'abord ce qui est EN VENTE, et trouve
 * ses brouillons et ses ventes sans parcourir toute la liste. « À
 * compléter » n'apparaît que s'il reste une fiche sans genre, taille ou
 * couleur : invisible dans les filtres de la recherche tant qu'elle l'est.
 */
const VUES = [
  { valeur: "en-vente", libelle: "En vente", garde: (p: Product) => p.status === "active" || p.status === "hidden" },
  { valeur: "brouillons", libelle: "Brouillons", garde: (p: Product) => p.status === "draft" },
  { valeur: "vendus", libelle: "Vendus", garde: (p: Product) => p.status === "sold" },
  { valeur: "a-completer", libelle: "À compléter", garde: (p: Product) => ficheIncomplete(p) },
] as const;

export default async function MerchantProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; info?: string; liste?: string | string[] }>;
}) {
  const brut = await searchParams;
  const { erreur, info } = brut;
  const supabase = await createClient();

  // Rôle et suspension sont traités par `(vendeur)/layout.tsx`.
  const merchant = await getMyMerchant(supabase);
  if (!merchant) redirect("/inscription/boutique");

  const catalogue = await getMerchantProducts(supabase, merchant);

  const vues = VUES.map((v) => ({ ...v, nombre: catalogue.filter(v.garde).length })).filter(
    (v) => v.valeur !== "a-completer" || v.nombre > 0,
  );
  const vue = vues.find((v) => v.valeur === premier(brut.liste)) ?? vues[0];
  const affiches = catalogue.filter(vue.garde);

  return (
    <TabScreen largeur="rangees">
      <TopBar title="Mes articles" />

      <ScreenBody>
        {erreur ? <Notice>{erreur}</Notice> : null}
        {info ? <Notice tone="success">{info}</Notice> : null}

        {catalogue.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="Votre boutique est vide"
            description="Une photo nette, la taille, la couleur et un prix clair : c'est tout ce qu'il faut pour recevoir vos premiers messages."
          >
            <Button href="/vendeur/produits/nouveau">Ajouter mon premier article</Button>
          </EmptyState>
        ) : (
          <Section className="gap-3">
            <Button href="/vendeur/produits/nouveau" icon={Plus}>
              Ajouter un article
            </Button>

            <nav aria-label="Mes articles" className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
              {vues.map((v) => (
                <Link
                  key={v.valeur}
                  href={`/vendeur/produits?liste=${v.valeur}`}
                  aria-current={v.valeur === vue.valeur ? "page" : undefined}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold",
                    v.valeur === vue.valeur
                      ? "border-ink bg-ink text-paper"
                      : v.valeur === "a-completer"
                        ? "border-warn bg-warn-soft text-warn-ink"
                        : "border-line bg-surface text-ink",
                  )}
                >
                  {v.libelle} · {v.nombre}
                </Link>
              ))}
            </nav>

            {vue.valeur === "a-completer" ? (
              <p className="text-sm text-ink-soft">
                Ajoutez pour qui, les tailles et les couleurs : sans elles, ces articles n&apos;apparaissent pas
                quand un client filtre sa recherche.
              </p>
            ) : null}

            {affiches.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">Aucun article ici.</p>
            ) : (
              affiches.map((p) => (
                <Link
                  key={p.id}
                  href={vue.valeur === "a-completer" ? `/vendeur/produits/${p.id}/modifier` : `/vendeur/produits/${p.id}/actions`}
                >
                  <ProductRow product={p} aCompleter={ficheIncomplete(p)} />
                </Link>
              ))
            )}
          </Section>
        )}
      </ScreenBody>
    </TabScreen>
  );
}
