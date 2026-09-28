import { redirect } from "next/navigation";
import { Unlock } from "lucide-react";
import { ActionRow } from "@/components/ui/ActionRow";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody, Section } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { createClient } from "@/lib/supabase/server";
import { clientSpaceFallback, getMyProfile } from "@/lib/data/session";
import { getPeersBlockedByMe } from "@/lib/data/messages";
import { unblockPeerAction } from "@/lib/actions/messages";
import type { Espace } from "@/lib/espace";

/**
 * Les personnes que j'ai bloquées, depuis les paramètres du compte. Monté
 * par deux routes, une par espace (`/compte/bloques`, `/vendeur/bloques`) :
 * chaque espace ne liste que SES blocages.
 */
export async function BlockedPeopleScreen({
  espace,
  searchParams,
}: {
  espace: Espace;
  searchParams: Promise<{ erreur?: string; info?: string }>;
}) {
  const { erreur, info } = await searchParams;
  const supabase = await createClient();

  // L'espace commerçant est gardé par son layout ; le client, non.
  if (espace === "client" && !(await getMyProfile(supabase, "client"))) {
    redirect(await clientSpaceFallback(supabase));
  }

  const bloques = await getPeersBlockedByMe(supabase, espace);
  const retour = espace === "merchant" ? "/vendeur/boutique" : "/compte";

  return (
    <Screen>
      <TopBar title="Personnes bloquées" backHref={retour} />
      <ScreenBody>
        <Section className="gap-4">
          {erreur ? <Notice>{erreur}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}

          {bloques.length === 0 ? (
            <p className="text-sm text-ink-soft">Vous n&apos;avez bloqué personne.</p>
          ) : (
            <Card className="px-3.5">
              {bloques.map((b) => (
                <ActionRow
                  key={b.conversationId}
                  icon={Unlock}
                  label={b.peerName || "Compte supprimé"}
                  description="Débloquer : vous pourrez de nouveau vous écrire."
                  action={unblockPeerAction}
                  hiddenFields={{ conversationId: b.conversationId, retour: "liste" }}
                />
              ))}
            </Card>
          )}
        </Section>
      </ScreenBody>
    </Screen>
  );
}
