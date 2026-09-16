"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ScreenBody, ScreenFooter, Section } from "@/components/ui/Screen";
import { Toggle } from "@/components/ui/Toggle";
import { PhotoPicker } from "@/components/product/PhotoPicker";
import { createProductAction, updateProductAction } from "@/lib/actions/products";
import type { ActionState } from "@/lib/actions/auth";
import type { CategoryOption } from "@/lib/data/reference";

type ProductFormProps = {
  merchantId: string;
  categories: CategoryOption[];
} & (
  | {
      mode: "create";
      /** La boutique est-elle validée ? UNE question, pas le statut
       * complet : ce formulaire n'a aucune raison de connaître les trois
       * valeurs de `merchant_status`, ni de savoir laquelle autorise
       * quoi. La réponse est calculée côté serveur par l'écran 24, à
       * partir de `merchant.status` — la seule source de vérité.
       *
       * Ce booléen vient du navigateur, donc il ne PROTÈGE rien : il
       * décide seulement de ce qui s'affiche. La publication reste
       * refusée par `products_check_publishable` (0002), en base, pour
       * une requête forgée à la main comme pour un clic. C'est la
       * distinction à garder : l'écran évite une impasse, la base
       * interdit. */
      canPublish: boolean;
    }
  | {
      mode: "edit";
      productId: string;
      initial: {
        title: string;
        categoryId: number;
        priceGnf: number;
        isNegotiable: boolean;
        description: string;
        imagePaths: string[];
      };
    }
);

/**
 * Formulaire produit — écrans 24 (nouveau) et « Modifier le produit »
 * (depuis l'écran 25). Les deux partagent tout sauf l'action appelée et
 * les boutons du bas : modifier ne touche jamais au statut (voir
 * `updateProductAction`), créer propose de publier — mais seulement à
 * une boutique qui en a le droit.
 *
 * POURQUOI LE BOUTON DISPARAÎT AU LIEU D'ÊTRE GRISÉ
 * Une boutique en attente voyait « Publier le produit » en action
 * PRINCIPALE, alors que la base refuse cette publication tant qu'elle
 * n'est pas validée. Le refus était correct et expliqué en français,
 * mais il arrivait APRÈS le clic, sur l'écran qui venait justement
 * d'inviter à publier — et c'est `/vendeur/attente` qui envoie ici, en
 * promettant des brouillons.
 *
 * Un bouton grisé aurait gardé le même défaut en plus discret : il
 * continue d'annoncer une capacité absente, sans dire quand elle
 * reviendra. On le remplace donc par l'action qui, elle, MARCHE —
 * enregistrer le brouillon — et par une phrase qui dit ce qui manque.
 * L'écran cesse de proposer une impasse au lieu de la refuser poliment.
 */
export function ProductForm(props: ProductFormProps) {
  const { merchantId, categories } = props;
  const isEdit = props.mode === "edit";
  const canPublish = props.mode === "create" && props.canPublish;
  const initial = isEdit ? props.initial : undefined;

  // Généré une seule fois, ici, côté navigateur : `PhotoPicker` construit
  // le chemin de chaque photo avec cet id AVANT que la ligne `products`
  // n'existe (voir `createProductAction`).
  const [productId] = useState(() => (isEdit ? props.productId : crypto.randomUUID()));
  const [isNegotiable, setIsNegotiable] = useState(initial?.isNegotiable ?? true);

  const action = isEdit ? updateProductAction : createProductAction;
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(action, null);

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <input type="hidden" name="productId" value={productId} />
      <ScreenBody>
        <Section className="gap-4">
          <Field label="Photos" hint="1 photo minimum, 3 maximum. Sans photo, un produit ne se vend pas.">
            <PhotoPicker merchantId={merchantId} productId={productId} initialPaths={initial?.imagePaths} />
          </Field>

          <Field label="Titre" htmlFor="title">
            <Input id="title" name="title" defaultValue={initial?.title} placeholder="Sac de riz importé 50 kg" />
          </Field>

          <Field label="Catégorie" htmlFor="categoryId">
            <Select id="categoryId" name="categoryId" defaultValue={initial?.categoryId ?? ""}>
              <option value="" disabled>
                Choisir une catégorie
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Prix" htmlFor="priceGnf">
            <Input
              id="priceGnf"
              name="priceGnf"
              inputMode="numeric"
              defaultValue={initial?.priceGnf}
              placeholder="450 000"
              className="pr-14"
            />
          </Field>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-semibold">Prix négociable</span>
              <span className="text-xs text-ink-soft">Le client sait qu&apos;il peut discuter.</span>
            </div>
            <Toggle checked={isNegotiable} label="Prix négociable" onClick={() => setIsNegotiable((v) => !v)} />
          </div>
          <input type="hidden" name="isNegotiable" value={isNegotiable ? "on" : ""} />

          <Field label="Description" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={initial?.description}
              placeholder="Riz parfumé importé, sac de 50 kg. Retrait au marché de Madina…"
            />
          </Field>

          {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        </Section>
      </ScreenBody>

      <ScreenFooter className="flex flex-col gap-2.5">
        {isEdit ? (
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        ) : canPublish ? (
          <>
            <Button type="submit" name="intent" value="publish" disabled={pending}>
              {pending ? "Publication…" : "Publier le produit"}
            </Button>
            <Button type="submit" name="intent" value="draft" variant="secondary" size="sm" disabled={pending}>
              Garder en brouillon
            </Button>
          </>
        ) : (
          /* Boutique en attente (ou refusée) : le brouillon devient
             l'action principale, puisque c'est la seule qui aboutit. La
             phrase est au-dessus du bouton et non en bas de page : elle
             répond à la question qu'on se pose au moment d'appuyer,
             « pourquoi je ne peux pas publier ? ». */
          <>
            <p className="text-center text-xs text-ink-soft">
              Publication disponible après validation de votre boutique.
            </p>
            <Button type="submit" name="intent" value="draft" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer le brouillon"}
            </Button>
          </>
        )}
      </ScreenFooter>
    </form>
  );
}
