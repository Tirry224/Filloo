import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { TopBar, Wordmark } from "@/components/ui/TopBar";

/**
 * Écran 3 — chargement du fil CLIENT.
 *
 * Ce fichier n'est pas une page : Next l'affiche AUTOMATIQUEMENT pendant
 * qu'une page du même dossier — donc de TOUTE l'application, celui-ci
 * étant à la racine — attend ses données. Rien à déclencher.
 *
 * C'est précisément ce qui en faisait un défaut : ce squelette est celui
 * du fil client (logo, ville, barre d'onglets à quatre onglets), et il
 * s'affichait aussi devant l'espace commerçant. Un commerçant voyait donc
 * « Conakry » et les onglets du client le temps du chargement — le même
 * mélange des deux espaces que `design/README.md` interdit. L'espace
 * vendeur a maintenant le sien : `src/app/vendeur/loading.tsx`.
 *
 * La barre de recherche a par ailleurs été retirée d'ici : l'accueil ne
 * l'a plus. Un squelette qui montre un élément que la vraie page n'a pas
 * fait SAUTER la page à l'arrivée des données, exactement ce que ce
 * fichier prétend éviter.
 *
 * Il reproduit la silhouette du fil plutôt qu'un tourniquet centré : la
 * page ne saute pas quand les données arrivent, et l'attente paraît plus
 * courte parce qu'on voit déjà où les choses vont se placer.
 */
export default function Loading() {
  return (
    <>
      <TopBar title={<Wordmark size="lg" />} right={<Chip icon={MapPin}>Conakry</Chip>} />
      <ScreenBody>
        <Section className="gap-3 pb-1">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-18 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </Section>
        <Section className="gap-3 pt-3">
          <Skeleton className="h-3 w-20" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
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
        </Section>
      </ScreenBody>
    </>
  );
}
