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
 * CE QUE CET ÉCRAN NE FAIT PLUS
 * Il servait les deux rôles, et `?vue=commercant` les distinguait. Trois
 * défauts tenaient à ça, et aucun n'était réparable sans supprimer le
 * paramètre :
 *
 *   - le même chemin rendait deux écrans différents, donc un favori, un
 *     lien partagé ou un retour arrière pouvait changer d'espace sous les
 *     pieds de la personne ;
 *   - `?vue=` absent voulait dire « client » par défaut, donc un
 *     commerçant ayant les deux comptes liés tombait dans sa boîte
 *     d'ACHETEUR chaque fois qu'un lien oubliait le paramètre ;
 *   - la barre d'onglets, les états vides et les boutons devaient tous
 *     porter un `asClient ? … : …`, c'est-à-dire que deux parcours
 *     vivaient dans le même fichier en se surveillant mutuellement.
 *
 * La boîte du commerçant est maintenant `/vendeur/messages`, un autre
 * fichier, dans un autre groupe, derrière une autre garde. Il n'y a plus
 * de branche à écrire : cet écran ne connaît qu'un seul rôle.
 */
export default async function ClientMessagesPage() {
  const supabase = await createClient();
  // Remplace le `if (!clientProfile && !merchantProfile) redirect(...)`
  // d'avant, qui laissait entrer un commerçant SANS compte client — il
  // voyait alors « Aucune conversation », une réponse à une question
  // qu'il n'avait pas posée. Ici, pas de compte client, pas d'écran.
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
