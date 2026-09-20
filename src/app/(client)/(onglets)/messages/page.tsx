import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ThreadRow } from "@/components/chat/ThreadRow";
import { createClient } from "@/lib/supabase/server";
import { requireClientSpace } from "@/lib/data/session";
import { getMyThreadsAsClient } from "@/lib/data/messages";

/**
 * Mes messages — côté CLIENT, et uniquement lui. Écrans 28 et 29 de
 * docs/ECRANS.md.
 *
 * Cet écran servait les deux rôles, distingués par `?vue=commercant` :
 * un même chemin rendait deux écrans (un favori ou un retour arrière
 * changeait d'espace sous les pieds), `?vue=` absent valait « client »
 * (un commerçant aux deux comptes tombait dans sa boîte d'ACHETEUR), et
 * tout l'écran portait des `asClient ? … : …`.
 *
 * La boîte du commerçant est maintenant `/vendeur/messages`, derrière une
 * autre garde : plus aucune branche à écrire ici.
 */
export default async function ClientMessagesPage() {
  const supabase = await createClient();
  // Pas de compte client, pas d'écran : la garde d'avant laissait entrer
  // un commerçant SANS compte client, qui voyait « Aucune conversation ».
  await requireClientSpace(supabase);

  const list = await getMyThreadsAsClient(supabase);

  return (
    <>
      <TopBar title="Mes messages" />

      <ScreenBody>
        {list.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Aucune conversation"
            description="Quand un produit vous intéresse, écrivez au vendeur depuis sa fiche. Vos échanges apparaîtront ici."
          >
            <Button href="/">Parcourir les produits</Button>
          </EmptyState>
        ) : (
          <Section className="gap-0 pt-0.5">
            {list.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} basePath="/messages" />
            ))}
          </Section>
        )}
      </ScreenBody>
    </>
  );
}
