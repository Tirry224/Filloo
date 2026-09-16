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
 * Il reproduit la silhouette de l'ACCUEIL commerçant — salutation, trois
 * cartes d'activité, quelques lignes — plutôt qu'un tourniquet centré :
 * la page ne saute pas quand les données arrivent, et l'attente paraît
 * plus courte parce qu'on voit déjà où les choses vont se placer.
 *
 * Il imitait « Mes produits » tant que cette liste vivait sur `/vendeur`.
 * Depuis qu'elle a son propre onglet, c'est l'accueil qu'on voit en
 * arrivant, et c'est donc lui qu'il faut annoncer. Ce même squelette sert
 * les quatre onglets : viser celui où l'on atterrit est le meilleur
 * compromis possible avec un seul fichier. Pas de ville ici : une
 * boutique n'en change pas au fil de la navigation.
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
