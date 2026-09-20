import { notFound } from "next/navigation";
import { Check, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { ActionRow } from "@/components/ui/ActionRow";
import { Sheet } from "@/components/ui/Sheet";
import { createClient } from "@/lib/supabase/server";
import { getProduct } from "@/lib/data/products";
import { markSoldAction, hideProductAction, republishProductAction, deleteProductAction } from "@/lib/actions/products";

/**
 * Écran 25 — actions sur un produit.
 *
 * Chaque action dit sa CONSÉQUENCE : « Masquer » et « Supprimer » se
 * ressemblent dans une liste, ce qu'ils font aux données non.
 *
 * LES ACTIONS SUIVENT L'ÉTAT RÉEL DU PRODUIT : un brouillon n'avait pas
 * de « Publier » (il fallait « Masquer » puis « Republier »), et se
 * voyait proposer « Marquer comme vendu ».
 *
 * CE QUE CETTE PAGE NE PROTÈGE PAS : retirer une ligne ne ferme rien,
 * `markSoldAction` restant appelable par une requête forgée. La faille
 * `draft → sold` — un brouillon sans photo entrant au catalogue parce que
 * `check_product_publishable` ne regardait que `active` — est fermée EN
 * BASE par 0020. Ici, on ne fait que cesser de proposer ce que la base
 * refusera.
 *
 * Aucune action nouvelle : publier un brouillon et republier un produit
 * masqué sont la MÊME écriture (`status = 'active'`), donc le même
 * `republishProductAction` ; seul l'intitulé change.
 */
export default async function ProductActionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const product = await getProduct(supabase, id);
  if (!product) notFound();

  const isDraft = product.status === "draft";

  return (
    <Sheet title={product.title} closeHref="/vendeur/produits">
      <div>
        {/* En premier pour un brouillon : c'est la raison pour laquelle on
            ouvre cette feuille. La base reste seule à décider si la
            publication aboutit — boutique validée, au moins une photo —
            et son refus revient à l'écran par `?erreur=`. Cette ligne ne
            promet rien, elle propose. */}
        {isDraft ? (
          <ActionRow
            icon={Eye}
            label="Publier le produit"
            description="Il entre dans le catalogue et devient visible de tous."
            action={republishProductAction}
            hiddenFields={{ productId: product.id }}
          />
        ) : null}

        {/* Vendre suppose d'avoir été en vitrine. Un brouillon n'y est
            jamais allé : la ligne n'aurait aucun sens pour lui, et 0020
            la refuserait de toute façon en base (voir l'en-tête). */}
        {product.status !== "sold" && !isDraft ? (
          <ActionRow
            icon={Check}
            label="Marquer comme vendu"
            description="Le produit reste visible, barré, avec la mention « Vendu »."
            action={markSoldAction}
            hiddenFields={{ productId: product.id }}
          />
        ) : null}

        <ActionRow
          icon={Pencil}
          label="Modifier le produit"
          description="Titre, prix, photos, description."
          href={`/vendeur/produits/${product.id}/modifier`}
        />

        {/* Retirer du catalogue ce qui n'y est pas n'a pas de sens : un
            brouillon n'a donc ni « Masquer », ni « Republier ». Les trois
            autres statuts gardent exactement les lignes qu'ils avaient. */}
        {isDraft ? null : product.status === "hidden" ? (
          <ActionRow
            icon={EyeOff}
            label="Republier"
            description="Le produit redevient visible dans le catalogue."
            action={republishProductAction}
            hiddenFields={{ productId: product.id }}
          />
        ) : (
          <ActionRow
            icon={EyeOff}
            label="Masquer du catalogue"
            description="Personne ne le voit plus, vous le republiez quand vous voulez."
            action={hideProductAction}
            hiddenFields={{ productId: product.id }}
          />
        )}

        <ActionRow
          icon={Trash2}
          label="Supprimer définitivement"
          description="Vos conversations à son sujet sont conservées."
          tone="danger"
          action={deleteProductAction}
          hiddenFields={{ productId: product.id }}
        />
      </div>
    </Sheet>
  );
}
