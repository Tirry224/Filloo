import { Card } from "@/components/ui/Card";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { TopBar } from "@/components/ui/TopBar";

/**
 * Chargement de l'espace COMMERÇANT. Sans lui, Next affiche le
 * `loading.tsx` de la racine — le squelette du fil CLIENT, ville et
 * onglets compris — devant `/vendeur`.
 *
 * Il reproduit la silhouette de l'ACCUEIL commerçant plutôt qu'un
 * tourniquet : la page ne saute pas à l'arrivée des données. Ce même
 * squelette sert les quatre onglets, viser celui où l'on atterrit étant le
 * meilleur compromis avec un seul fichier.
 */
export default function LoadingSeller() {
  return (
    <>
      <TopBar
        title={
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        }
      />

      <ScreenBody>
        <Section className="gap-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-3 w-64" />
          </div>

          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-3 w-24" />
            <div className="flex gap-2.5">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="flex flex-1 flex-col gap-2 p-3">
                  <Skeleton className="h-4.5 w-4.5 rounded-md" />
                  <Skeleton className="h-6 w-8" />
                  <Skeleton className="h-2.5 w-full" />
                </Card>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-3 w-32" />
            {[0, 1, 2].map((i) => (
              <Card key={i} className="flex items-center gap-3 p-3.5">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
                <Skeleton className="h-4 w-16 rounded-sm" />
              </Card>
            ))}
          </div>
        </Section>
      </ScreenBody>
    </>
  );
}
