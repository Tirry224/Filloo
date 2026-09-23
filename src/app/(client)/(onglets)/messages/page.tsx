import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ThreadRow } from "@/components/chat/ThreadRow";
import { createClient } from "@/lib/supabase/server";
import { requireClientSpace } from "@/lib/data/session";
import { getMyThreadsAsClient } from "@/lib/data/messages";

export default async function ClientMessagesPage() {
  const supabase = await createClient();
  // Pas de compte client, pas d'écran : sinon un commerçant sans compte
  // client entre et lit « Aucune conversation ».
  await requireClientSpace(supabase);

  const list = await getMyThreadsAsClient(supabase);

  return (
    <>
      <TopBar title="Mes messages" />

      <ScreenBody rangees>
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
