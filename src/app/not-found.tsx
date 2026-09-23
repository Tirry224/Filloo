import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenBody } from "@/components/ui/Screen";
import { TopBar, Wordmark } from "@/components/ui/TopBar";

export default function NotFound() {
  return (
    <Screen>
      <TopBar title={<Wordmark />} />
      <ScreenBody>
        <EmptyState
          icon={Compass}
          title="Cette page n'existe pas"
          description="Le lien est peut-être ancien, ou le produit a été retiré par son vendeur."
        >
          <Button href="/">Voir les produits</Button>
          <Button variant="secondary" href="/recherche">
            Rechercher
          </Button>
        </EmptyState>
      </ScreenBody>
    </Screen>
  );
}
