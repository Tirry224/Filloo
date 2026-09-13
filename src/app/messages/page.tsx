import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { BottomNav } from "@/components/ui/BottomNav";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ThreadRow } from "@/components/chat/ThreadRow";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, clientSpaceFallback } from "@/lib/data/session";
import { getMyThreadsAsClient, getMyThreadsAsMerchant } from "@/lib/data/messages";

/**
 * Messages — écrans 27, 28 et 29 de docs/ECRANS.md.
 *
 * Le même écran sert aux deux rôles : côté client, la liste montre des
 * BOUTIQUES ; côté commerçant, des PERSONNES. `?vue=` distingue les deux
 * quand la connexion a ses deux comptes liés — sinon le seul rôle
 * disponible s'affiche directement, sans qu'il y ait de choix à faire.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const { vue } = await searchParams;
  const supabase = await createClient();

  const [clientProfile, merchantProfile] = await Promise.all([
    getMyProfile(supabase, "client"),
    getMyProfile(supabase, "merchant"),
  ]);

  // Sans aucun profil, personne n'est connecté : `/messages` affichait
  // alors « Aucune conversation », c'est-à-dire une réponse à une question
  // qu'il n'avait pas posée. Vu à l'écran le 2026-09-13 en ouvrant
  // l'onglet « Messages » sans session. `/compte` redirigeait déjà, lui —
  // deux écrans du même espace ne peuvent pas traiter l'anonymat
  // différemment.
  if (!clientProfile && !merchantProfile) redirect(await clientSpaceFallback(supabase));

  const hasBoth = Boolean(clientProfile) && Boolean(merchantProfile);
  const asClient = hasBoth ? vue !== "commercant" : Boolean(clientProfile);

  const list = asClient ? await getMyThreadsAsClient(supabase) : await getMyThreadsAsMerchant(supabase);

  return (
    <Screen>
      <TopBar title={asClient ? "Mes messages" : "Messages"} />

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
              <ThreadRow key={thread.id} thread={thread} />
            ))}
          </Section>
        )}
      </ScreenBody>

      <BottomNav active="messages" space={asClient ? "client" : "merchant"} />
    </Screen>
  );
}
