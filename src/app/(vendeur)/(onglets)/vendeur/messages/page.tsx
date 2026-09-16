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
 * Nouvelle route, ancien écran : c'est ce qui vivait derrière
 * `/messages?vue=commercant`. Le déplacer sous `/vendeur` fait trois
 * choses qu'une query string ne pouvait pas faire :
 *
 *   - il hérite de la garde de `(vendeur)/layout.tsx`, donc un client
 *     authentifié qui tape cette URL n'y entre pas — avant, il obtenait
 *     `/messages` sans `?vue=`, c'est-à-dire sa propre boîte, ce qui
 *     masquait le problème plutôt que de le poser ;
 *   - il hérite de la barre d'onglets commerçant, sans que cet écran ait
 *     à la demander ;
 *   - son adresse est stable : plus rien à reproposer à chaque lien, donc
 *     plus rien à perdre en chemin.
 *
 * Aucune garde n'est écrite ici, et c'est le signe que le découpage
 * marche : le layout l'a déjà faite pour tout ce qui vit sous `/vendeur`.
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
