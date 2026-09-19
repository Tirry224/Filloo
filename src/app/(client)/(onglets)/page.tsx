import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { ProductCard } from "@/components/product/ProductCard";
import { Card } from "@/components/ui/Card";
import { Photo } from "@/components/ui/Photo";
import { Badge } from "@/components/ui/Badge";
import { PriceTag } from "@/components/product/PriceTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Package } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FALLBACK_CITY, getCategories, getCities, getDefaultCityName } from "@/lib/data/reference";
import { landingForSession } from "@/lib/data/session";
import { searchProducts } from "@/lib/data/products";

/**
 * Fil d'accueil — écrans 1 et 2 de docs/ECRANS.md.
 *
 * Le filtre de ville passe par l'URL (`/?ville=Boké`) et non par un état
 * caché dans la page. Conséquence : le fil filtré se partage par lien, le
 * bouton « retour » du téléphone défait le filtre, et l'écran vide est
 * atteignable pour de vrai — pas seulement en imagination. La catégorie
 * suit la même règle (`&categorie=...`).
 *
 * Sans `?ville=` dans l'URL, le défaut est la ville de résidence du
 * client connecté (`profiles.city_id`) plutôt que "Conakry" en dur —
 * décision du 2026-09-11 (voir docs/REPRISE.md, étape 4). Un visiteur non
 * connecté, un compte sans profil client, ou un client qui n'a pas encore
 * renseigné sa ville retombent sur "Conakry". Une fois `ville` présent
 * dans l'URL (l'utilisateur a changé de ville depuis l'écran de
 * recherche), il gagne toujours : ceci ne fixe qu'un point de départ, pas
 * un filtre permanent — un client peut chercher ailleurs que chez lui.
 *
 * Un seul appel réseau : `inCity` (toute la ville, sans filtre de
 * catégorie) est déjà tout ce dont l'écran a besoin — la catégorie choisie
 * ne fait que filtrer ce résultat en mémoire, comme `src/lib/mock.ts` le
 * faisait avant. Le catalogue d'une ville reste de taille modeste (limite
 * dure de 50 dans `search_products`) : un deuxième aller-retour réseau
 * n'apporterait rien.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ville?: string; categorie?: string; tri?: string }>;
}) {
  const { ville: villeParam, categorie = "Tout", tri = "recent" } = await searchParams;
  const supabase = await createClient();

  /* Le fil client n'est pas l'écran d'ouverture d'un commerçant — décision
     écrite (`design/README.md`, `docs/SPEC.md` décision 8) : les deux rôles
     n'ont ni la même barre d'onglets, ni le même écran d'ouverture. Une
     connexion sans compte client repart donc chez elle.

     Corrigé ici EN PLUS de `signInAction` : cette adresse est atteinte
     autrement que par une connexion — un favori, un lien partagé, un simple
     rechargement — et l'aiguillage ne doit pas dépendre du chemin parcouru
     pour y arriver.

     Un visiteur non connecté et une personne qui possède les deux comptes
     liés ne sont pas concernés : `landingForSession` ne renvoie `/vendeur`
     que pour une connexion QUI N'A QUE le compte commerçant. */
  const landing = await landingForSession(supabase);
  if (landing !== "/") redirect(landing);

  const [cities, categories] = await Promise.all([getCities(supabase), getCategories(supabase)]);
  // Même résolution que `/recherche`, au même endroit : la règle « ma
  // ville d'abord, Conakry sinon » était écrite deux fois et appliquée une
  // seule.
  const ville = villeParam ?? (await getDefaultCityName(supabase, cities));
  const city = cities.find((c) => c.name === ville) ?? cities.find((c) => c.name === FALLBACK_CITY);

  const sort = tri === "populaire" ? "popular" : "recent";
  const inCity = city ? await searchProducts(supabase, { cityId: city.id, sort, limit: 50 }) : [];
  const visible = categorie === "Tout" ? inCity : inCity.filter((p) => p.category === categorie);
  const featuredHere = visible.find((p) => p.isFeatured) ?? null;

  const triHref = (valeur: string) =>
    `/?ville=${encodeURIComponent(ville)}&categorie=${encodeURIComponent(categorie)}&tri=${valeur}`;
  const gridItems = featuredHere ? visible.filter((p) => p.id !== featuredHere.id) : visible;

  return (
    <>
      <TopBar
        title={<Wordmark size="lg" />}
        right={<Chip icon={MapPin}>{ville}</Chip>}
      />

      <ScreenBody>
        <Section className="gap-3 pb-1">
          {/* `overflow-x-auto` : la rangée de catégories défile au doigt
              plutôt que de passer à la ligne et de manger l'écran. */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
            <Link href={`/?ville=${encodeURIComponent(ville)}&categorie=Tout`}>
              <Chip selected={categorie === "Tout"}>Tout</Chip>
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/?ville=${encodeURIComponent(ville)}&categorie=${encodeURIComponent(c.name)}`}
              >
                <Chip selected={c.name === categorie}>{c.name}</Chip>
              </Link>
            ))}
          </div>
        </Section>

        {visible.length === 0 && categorie !== "Tout" && inCity.length > 0 ? (
          <EmptyState
            icon={Package}
            title={`Aucun produit « ${categorie} » à ${ville}`}
            description="Essayez une autre catégorie, ou regardez tout ce qui est en vente dans cette ville."
          >
            <Button href={`/?ville=${encodeURIComponent(ville)}`}>Voir toutes les catégories</Button>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Package}
            title={`Aucun produit à ${ville} pour le moment`}
            description="Makiti démarre à Conakry. Changez de ville pour voir ce qui est en vente, ou inscrivez-vous comme vendeur pour être le premier ici."
          >
            {ville !== FALLBACK_CITY ? (
              <Button href={`/?ville=${encodeURIComponent(FALLBACK_CITY)}`}>
                Voir les produits à {FALLBACK_CITY}
              </Button>
            ) : null}
            <Button variant="secondary" href="/inscription">
              Devenir vendeur à {ville}
            </Button>
          </EmptyState>
        ) : (
          <>
        {featuredHere ? (
          <Section className="gap-2 pt-2 pb-0">
            <SectionLabel>À la une</SectionLabel>
            <Link href={`/produit/${featuredHere.id}`}>
              <Card className="flex">
                <Photo ratio="free" className="w-26 shrink-0" />
                <div className="flex flex-col justify-center gap-1 px-3 py-3">
                  <h3 className="text-base font-semibold">{featuredHere.title}</h3>
                  <PriceTag amount={featuredHere.priceGnf} size="md" />
                  <p className="text-2xs text-ink-soft">
                    {featuredHere.merchant.shopName} · {featuredHere.merchant.city}
                  </p>
                  {featuredHere.isNegotiable ? (
                    <Badge tone="accent" className="self-start">
                      Négociable
                    </Badge>
                  ) : null}
                </div>
              </Card>
            </Link>
          </Section>
        ) : null}

        <Section className="gap-2 pt-3.5">
          {/* « Populaires » était un <span> en couleur d'accent, posé
              exactement là où toutes les autres listes de l'application
              mettent un lien actif : on le touchait, rien ne bougeait. Le
              fil était figé sur `recent` alors que `search_products` sait
              déjà trier par popularité et que la décision 4 de
              docs/SPEC.md prévoit ce classement.

              Les deux sont maintenant de vrais liens, et celui qui est
              actif porte la couleur d'accent — c'est-à-dire que la
              couleur redevient une information vraie au lieu d'un
              ornement. Ils gardent ville et catégorie : changer l'ordre
              ne doit pas défaire le filtre. */}
          <div className="flex items-baseline justify-between">
            {sort === "popular" ? (
              <Link href={triHref("recent")} className="text-sm font-semibold text-accent">
                Récents
              </Link>
            ) : (
              <SectionLabel>Récents</SectionLabel>
            )}
            {sort === "popular" ? (
              <SectionLabel>Populaires</SectionLabel>
            ) : (
              <Link href={triHref("populaire")} className="text-sm font-semibold text-accent">
                Populaires
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {gridItems.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
          </>
        )}
      </ScreenBody>
    </>
  );
}
