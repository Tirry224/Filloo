import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ThreadRow } from "@/components/chat/ThreadRow";
import { createClient } from "@/lib/supabase/server";
import { getMyThreadsAsMerchant } from "@/lib/data/messages";

/**
 * Messages — côté COMMERÇANT. Écran 27 de docs/ECRANS.md.
 *
 * Nouvelle route, ancien écran : il vivait derrière
 * `/messages?vue=commercant`. Sous `/vendeur`, il hérite de la garde de
 * `(vendeur)/layout.tsx` — un client qui tape cette URL n'y entre plus,
 * au lieu de retomber sur sa propre boîte, ce qui masquait le problème —
 * et de la barre d'onglets commerçant, avec une adresse stable.
 *
 * Aucune garde écrite ici, et c'est le signe que le découpage marche.
 */
export default async function MerchantMessagesPage() {
  const supabase = await createClient();
  const list = await getMyThreadsAsMerchant(supabase);

  return (
    <>
      <TopBar title="Messages" />

      <ScreenBody>
        {list.length === 0 ? (
          /* Un écran vide dit ce qu'il faut faire ENSUITE — et ce n'est
             pas la même chose selon l'espace. Ce texte conseillait
             d'écrire au vendeur depuis sa fiche, servi à un commerçant
             qui attend les messages de ses clients : il lui disait
             d'aller acheter, puis le sortait de son espace. */
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
    </>
  );
}
