import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenBody, Section, TabScreen } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ThreadRow } from "@/components/chat/ThreadRow";
import { createClient } from "@/lib/supabase/server";
import { getMyThreadsAsMerchant } from "@/lib/data/messages";

/**
 * Sous `/vendeur`, cet écran hérite de la garde de `(vendeur)/layout.tsx` :
 * aucune garde n'est écrite ici.
 */
export default async function MerchantMessagesPage() {
  const supabase = await createClient();
  const list = await getMyThreadsAsMerchant(supabase);

  return (
    <TabScreen largeur="rangees">
      <TopBar title="Messages" />

      <ScreenBody>
        {list.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Aucune conversation"
            description="Vos clients vous écriront depuis vos produits. Publiez et soignez vos photos : c'est ce qui déclenche le premier message."
          >
            <Button href="/vendeur/produits">Voir mes produits</Button>
          </EmptyState>
        ) : (
          <Section className="gap-0 pt-0.5">
            {list.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} basePath="/vendeur/messages" />
            ))}
          </Section>
        )}
      </ScreenBody>
    </TabScreen>
  );
}
