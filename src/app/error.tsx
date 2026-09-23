"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenBody } from "@/components/ui/Screen";
import { TopBar, Wordmark } from "@/components/ui/TopBar";

/**
 * `"use client"` est obligatoire : le bouton « Réessayer » ne relance le
 * rendu que depuis le navigateur.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <Screen>
      <TopBar title={<Wordmark />} />
      <div className="flex shrink-0 items-center gap-2.5 bg-warn-soft px-4 py-2.5 text-warn-ink">
        <WifiOff size={16} strokeWidth={2.2} aria-hidden />
        <span className="text-sm font-semibold">Pas de connexion</span>
      </div>
      <ScreenBody>
        <EmptyState
          icon={WifiOff}
          title="Impossible d'afficher cette page"
          description="Vérifiez votre connexion, puis réessayez."
        >
          <Button onClick={reset}>Réessayer</Button>
          <Button variant="secondary" href="/">
            Retour à l&apos;accueil
          </Button>
        </EmptyState>
      </ScreenBody>
    </Screen>
  );
}
