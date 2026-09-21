import { notFound } from "next/navigation";
import { MapPin, Package, Search } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { FakeInput, Field, Input, Textarea } from "@/components/ui/Field";
import { Photo } from "@/components/ui/Photo";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductRow } from "@/components/product/ProductRow";
import { MerchantCard } from "@/components/product/MerchantCard";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ProductRef } from "@/components/chat/ProductRef";
import { ThreadRow } from "@/components/chat/ThreadRow";
import { conversation, findProduct, products, threads } from "@/lib/mock";

/**
 * Catalogue vivant du design system, à l'adresse /styleguide.
 *
 * Tout composant y apparaît isolé de tout écran : voir ce qui existe déjà
 * avant d'en écrire un de plus, repérer une incohérence (deux gris
 * presque identiques), et vérifier qu'un changement dans tokens.css n'a
 * rien cassé ailleurs.
 */

const COLORS = [
  ["paper", "bg-paper"], ["surface", "bg-surface"], ["placeholder", "bg-placeholder"],
  ["ink", "bg-ink"], ["ink-soft", "bg-ink-soft"], ["line", "bg-line"],
  ["accent", "bg-accent"], ["accent-hover", "bg-accent-hover"], ["accent-soft", "bg-accent-soft"],
  ["success", "bg-success"], ["success-soft", "bg-success-soft"],
  ["warn", "bg-warn"], ["warn-soft", "bg-warn-soft"],
  ["danger", "bg-danger"], ["danger-soft", "bg-danger-soft"],
] as const;

const TEXTS = [
  ["text-3xl", "27px — prix de la fiche produit"],
  ["text-2xl", "23px — logo, gros titres"],
  ["text-xl", "20px — titres d'écran"],
  ["text-lg", "17px — titres de barre et de section"],
  ["text-base", "15px — texte courant, champs, boutons"],
  ["text-sm", "13px — texte secondaire"],
  ["text-xs", "12px — aides, légendes"],
  ["text-2xs", "11px — badges, horodatage"],
] as const;

const RADII = ["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl"] as const;

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Section className="gap-3 border-b border-line py-6">
      <div className="flex flex-col gap-1">
        <SectionLabel>{title}</SectionLabel>
        {note ? <p className="text-xs leading-normal text-ink-soft">{note}</p> : null}
      </div>
      {children}
    </Section>
  );
}

/* Rendu à la requête, pas au build : sinon le résultat de `notFound()`
   serait figé dans une page statique mise en cache.

   PIÈGE : la réponse reste un 200 portant « Cette page n'existe pas », pas
   un vrai 404 — attendu en Next 16 quand le flux a commencé avant la garde
   (`not-found.md`, « Calling notFound() after streaming has started »).
   Next injecte en échange `<meta name="robots" content="noindex">`, ce qui
   ferme le risque réel. Un vrai 404 demanderait la garde dans `proxy`
   (remplaçant de `middleware`), qui s'exécute AVANT le flux. */
export const dynamic = "force-dynamic";

/**
 * Page de TRAVAIL : accessible en développement, introuvable en production
 * — prérendue, elle partait en ligne ouverte à tous.
 *
 * `notFound()` conditionnel plutôt qu'un `rm` : l'étape 1 de
 * `docs/REPRISE.md` (ouvrir les 33 écrans) se fait depuis ici, l'outil
 * restant entier en local. À supprimer quand cette étape sera terminée.
 */
export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  const riz = findProduct("p-riz")!;
  const huile = findProduct("p-huile")!;

  return (
    <Screen>
      <TopBar title={<Wordmark />} right={<span className="text-sm text-ink-soft">Design system</span>} />

      <ScreenBody>
        <Block title="Couleurs" note="Nommées par rôle, jamais par teinte. Définies dans src/styles/tokens.css.">
          <div className="grid grid-cols-3 gap-2.5">
            {COLORS.map(([name, cls]) => (
              <div key={name} className="flex flex-col gap-1">
                <div className={`h-12 rounded-md border border-line ${cls}`} />
                <span className="text-2xs text-ink-soft">{name}</span>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Typographie" note="Huit tailles, pas une de plus. Une seule police, Figtree : les titres se distinguent par la graisse et l'interlettrage, pas par la famille (R4).">
          <div className="flex flex-col gap-3">
            {TEXTS.map(([cls, note]) => (
              <div key={cls} className="flex flex-col gap-0.5">
                <span className={`${cls} font-semibold`}>Sac de riz importé 50 kg</span>
                <span className="text-2xs text-ink-soft">
                  {cls} — {note}
                </span>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Rayons" note="Le rayon suit la taille de l'élément : petit badge, petit rayon.">
          <div className="flex flex-wrap gap-3">
            {RADII.map((r) => (
              <div key={r} className="flex flex-col items-center gap-1">
                <div className={`size-14 border border-line bg-surface ${r}`} />
                <span className="text-2xs text-ink-soft">{r}</span>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Boutons" note="Hauteur 52px, ou 44px en taille sm — le minimum tactile.">
          <div className="flex flex-col gap-2.5">
            <Button>Contacter le vendeur</Button>
            <Button variant="secondary">Garder en brouillon</Button>
            <Button variant="danger">Supprimer définitivement</Button>
            <Button variant="ghost">Annuler</Button>
            <Button size="sm" variant="secondary">Taille sm — 44px</Button>
            <Button disabled>Désactivé</Button>
          </div>
        </Block>

        <Block title="Badges et puces">
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">Négociable</Badge>
            <Badge>Vendu</Badge>
            <Badge tone="success">Publié</Badge>
            <Badge tone="warn">En attente</Badge>
            <Badge tone="danger">Refusée</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip selected>Tout</Chip>
            <Chip>Alimentation</Chip>
            <Chip icon={MapPin}>Conakry</Chip>
          </div>
        </Block>

        <Block title="Champs" note="Chaque intitulé est un vrai label relié au champ.">
          <Field label="Nom de la boutique" htmlFor="sg-shop">
            <Input id="sg-shop" placeholder="Chez Aïssatou" />
          </Field>
          <Field label="Description" htmlFor="sg-desc" hint="Deux phrases suffisent.">
            <Textarea id="sg-desc" rows={3} placeholder="Alimentation générale…" />
          </Field>
          <FakeInput className="text-ink-soft">
            <Search size={19} strokeWidth={1.8} aria-hidden />
            Faux champ — ouvre un autre écran
          </FakeInput>
        </Block>

        <Block title="Avatars et emplacements de photo">
          <div className="flex items-center gap-3">
            <Avatar name="Mariama Diallo" />
            <Avatar name="Chez Aïssatou" kind="shop" />
            <Avatar name="Ibrahima Camara" size={58} />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Photo ratio="square" className="rounded-md" />
            <Photo ratio="square" className="rounded-md" label="1 sur 3" />
            <Photo ratio="square" className="rounded-full" iconSize={20} />
          </div>
        </Block>

        <Block title="Produits">
          <div className="grid grid-cols-2 gap-3">
            <ProductCard product={riz} />
            <ProductCard product={huile} />
          </div>
          <div className="flex flex-col gap-2.5">
            {products.slice(0, 3).map((p) => (
              <ProductRow key={p.id} product={p} />
            ))}
          </div>
          <MerchantCard merchant={riz.merchant} />
        </Block>

        <Block title="Messagerie">
          <div className="flex flex-col gap-2.5">
            <ProductRef product={riz} />
            {conversation.slice(0, 3).map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            <ProductRef product={huile} />
          </div>
          <Card className="px-3">
            {threads.slice(0, 2).map((t) => (
              <ThreadRow key={t.id} thread={t} basePath="/messages" />
            ))}
          </Card>
        </Block>

        <Block title="Chargement" note="Une silhouette du contenu attendu, jamais un tourniquet.">
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <Card key={i} className="flex flex-col">
                <Skeleton className="h-33 rounded-none" />
                <div className="flex flex-col gap-2 px-3 py-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-2.5 w-2/3" />
                </div>
              </Card>
            ))}
          </div>
        </Block>

        <Block title="État vide" note="Il explique pourquoi c'est vide et propose une sortie.">
          <Card>
            <EmptyState
              icon={Package}
              title="Votre boutique est vide"
              description="Un premier produit avec une photo nette et un prix clair suffit pour recevoir vos premiers messages."
            >
              <Button>Ajouter mon premier produit</Button>
            </EmptyState>
          </Card>
        </Block>
      </ScreenBody>
    </Screen>
  );
}
