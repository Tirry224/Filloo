"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenBody } from "@/components/ui/Screen";
import { TopBar, Wordmark } from "@/components/ui/TopBar";

/**
 * `"use client"` est obligatoire : le bouton « Réessayer » ne relance le
 * rendu que depuis le navigateur.
 *
 * Cet écran ne parle PAS de réseau : il reçoit toutes les erreurs, et la
 * plupart sont des pannes serveur. Il affirmait « Pas de connexion » pour
 * chacune ; une suppression de compte refusée par Supabase passait ainsi
 * pour un problème de wifi. La vraie coupure, `OfflineBanner` (layout
 * racine) la signale déjà, d'après le navigateur.
 *
 * `digest` est la référence que Next écrit aussi dans les journaux
 * Vercel : la montrer permet de retrouver la ligne exacte.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Screen>
      <TopBar title={<Wordmark />} />
      <ScreenBody>
        <EmptyState
          icon={CircleAlert}
          title="Impossible d'afficher cette page"
          description={`Une erreur est survenue de notre côté. Réessayez dans un instant.${
            error.digest ? ` Référence : ${error.digest}` : ""
          }`}
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
