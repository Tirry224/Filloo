import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { TopBar, Wordmark } from "@/components/ui/TopBar";

/**
 * Écran 3 — chargement du fil CLIENT. Ce n'est pas une page : Next
 * l'affiche automatiquement pendant qu'un écran de ce groupe attend ses
 * données, et il est posé DANS le groupe client pour ne pas s'afficher
 * devant l'espace commerçant, qui a le sien.
 *
 * Il reproduit la silhouette du fil plutôt qu'un tourniquet, et jamais un
 * élément que la vraie page n'a pas : un squelette qui ne correspond plus
 * fait SAUTER la page à l'arrivée des données.
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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
