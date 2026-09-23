import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { TopBar, Wordmark } from "@/components/ui/TopBar";
import { ProductGrid } from "@/components/product/ProductGrid";

export default function Loading() {
  return (
    <TabScreen largeur="grille">
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
          <ProductGrid>
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
          </ProductGrid>
        </Section>
      </ScreenBody>
    </TabScreen>
  );
}
