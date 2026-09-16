import { Card } from "@/components/ui/Card";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { TopBar } from "@/components/ui/TopBar";

/**
 * Chargement de l'espace COMMERÇANT.
 *
 * Existe pour une raison précise : le `loading.tsx` de la racine est le
 * squelette du fil client — logo Makiti, ville, quatre onglets. Sans ce
 * fichier, Next l'affichait aussi devant `/vendeur`, et un commerçant
 * voyait « Conakry » et les onglets du client pendant le chargement de sa
 * propre boutique. Un fichier `loading.tsx` placé dans un dossier prend le
 * pas sur celui du parent pour ce dossier et ses enfants : c'est tout ce
 * qu'il fallait.
 *
 * Il reproduit la silhouette de « Mes produits » — en-tête de boutique,
 * deux cartes, lignes de produits — plutôt qu'un tourniquet centré : la
 * page ne saute pas quand les données arrivent, et l'attente paraît plus
 * courte parce qu'on voit déjà où les choses vont se placer. Pas de
 * ville ici : une boutique n'en change pas au fil de la navigation.
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
        <Section className="gap-3.5">
          <div className="flex gap-3">
            <Card className="flex flex-1 flex-col gap-2 p-3.5">
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-2.5 w-24" />
            </Card>
            <Card className="flex flex-1 flex-col gap-2 p-3.5">
              <Skeleton className="h-5 w-5 rounded-md" />
              <Skeleton className="h-2.5 w-20" />
            </Card>
          </div>

          <Skeleton className="h-3 w-24" />

          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="flex gap-3 p-3">
                <Skeleton className="h-16 w-16 shrink-0 rounded-md" />
                <div className="flex flex-1 flex-col justify-center gap-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3.5 w-1/3" />
                </div>
              </Card>
            ))}
          </div>
        </Section>
      </ScreenBody>
    </>
  );
}
