import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { Photo } from "@/components/ui/Photo";
import { PriceTag } from "@/components/product/PriceTag";
import { Sheet } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/server";
import { getThreadContext, getCitableProducts } from "@/lib/data/messages";
import { messagesBase, type Espace } from "@/lib/espace";

/**
 * Écran 31 — citer un produit dans un fil.
 *
 * C'est la pièce qui rend viable le choix « un seul fil par client » :
 * puisque le fil ne porte plus de produit, chaque message doit pouvoir
 * dire de quoi il parle. Chaque ligne est un LIEN qui repose la citation
 * sur `/messages/{id}` (même principe que les feuilles de filtre de
 * recherche) : pas de bouton « valider » séparé, choisir EST valider.
 */
export async function QuoteProductScreen({
  espace,
  params,
}: {
  /** Imposé par la route qui monte ce composant, jamais lu dans l'URL :
   *  c'est ce qui garde la feuille dans l'espace d'où elle a été ouverte. */
  espace: Espace;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const base = messagesBase(espace);
  const supabase = await createClient();

  const context = await getThreadContext(supabase, id);
  if (!context) notFound();

  /* La même garde que `ThreadScreen`, pour la même raison : un fil a deux
     côtés, `getThreadContext` sait lequel est le nôtre, et le chemin
     emprunté doit correspondre à ce fait. Elle manquait ici — le fil
     était gardé, ses trois feuilles ne l'étaient pas. Un commerçant
     ouvrant `/messages/<id>/actions` obtenait donc cette feuille habillée
     en client, dont le bouton de fermeture ne le ramenait dans son espace
     qu'au coup d'après, par le rattrapage de `ThreadScreen`.

     C'est exactement le motif que cette réorganisation corrigeait
     ailleurs : la garde écrite sur un écran et oubliée sur ses voisins. */
  const espaceReel: Espace = context.iAmMerchant ? "merchant" : "client";
  if (espaceReel !== espace) redirect(`${messagesBase(espaceReel)}/${id}/citer`);

  const products = await getCitableProducts(supabase, context.merchantId);

  return (
    <Sheet
      title="De quel produit parlez-vous ?"
      description="Le produit sera affiché au-dessus de votre message. Le vendeur saura immédiatement de quoi il s'agit."
      closeHref={`${base}/${id}`}
    >
      {products.length === 0 ? (
        <p className="text-sm text-ink-soft">Cette boutique n&apos;a aucun produit disponible pour l&apos;instant.</p>
      ) : (
        <div>
          {products.map((product) => (
            <Link key={product.id} href={`${base}/${id}?produit=${product.id}`}>
              <ChoiceRow
                label={product.title}
                leading={
                  <Photo src={product.imageUrl} ratio="free" className="size-11 shrink-0 rounded-md" iconSize={17} />
                }
                detail={
                  product.status === "sold" ? <Badge>Vendu</Badge> : <PriceTag amount={product.priceGnf} size="sm" />
                }
              />
            </Link>
          ))}
        </div>
      )}
    </Sheet>
  );
}
