import { Megaphone, MessageCircle } from "lucide-react";
import { EnTeteEquipe } from "@/components/equipe/EnTeteEquipe";
import { gardeEquipe } from "@/components/equipe/garde";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody } from "@/components/ui/Screen";
import { cn } from "@/lib/cn";
import { CHEMINS_EQUIPE, compterNonLusEquipe, lireConversationEquipe, type MessageConversation } from "@/lib/data/equipe";
import type { Espace } from "@/lib/espace";
import { formatMessageTime } from "@/lib/format";

/**
 * « Équipe Filloo », onglet Conversation : mon fil privé avec l'équipe,
 * pour cet espace, comme une conversation du site.
 *
 * Après un envoi (`?envoye=1`) : message envoyé → retour → la
 * conversation → retour → la page de compte. L'écran d'écriture est
 * REMPLACÉ dans l'historique (`ecrireALEquipeAction`).
 */
export async function ConversationEquipeScreen({
  espace,
  searchParams,
}: {
  espace: Espace;
  searchParams: Promise<{ envoye?: string }>;
}) {
  const { envoye } = await searchParams;
  const { supabase, user } = await gardeEquipe(espace);

  const messages = await lireConversationEquipe(supabase, user.id, espace);
  await supabase.rpc("marquer_fil_equipe_lu", { p_espace: espace });
  // Ce qui reste non lu après ce marquage : les annonces, pour la pastille de l'onglet voisin.
  const nonLus = await compterNonLusEquipe(supabase, user.id, espace);
  return <ConversationEquipeVue espace={espace} messages={messages} nonLus={nonLus} envoye={Boolean(envoye)} />;
}

/** L'onglet, affichage seul : la page de test visuel le monte avec des données fictives. */
export function ConversationEquipeVue({
  espace,
  messages,
  nonLus,
  envoye,
}: {
  espace: Espace;
  messages: MessageConversation[];
  nonLus: number;
  envoye: boolean;
}) {
  const chemin = CHEMINS_EQUIPE[espace];
  const retour = espace === "merchant" ? "/vendeur/boutique" : "/compte";
  return (
    <Screen largeur="rangees">
      <EnTeteEquipe
        espace={espace}
        onglet="conversation"
        backHref={envoye ? `${chemin}/conversation` : retour}
        nonLus={nonLus}
      />
      <ScreenBody className={messages.length ? "justify-end" : undefined}>
        {envoye ? (
          <div className="px-4 pt-4">
            <Notice tone="success">Message envoyé. L&apos;équipe vous répondra ici.</Notice>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Écrivez à l'équipe Filloo"
            description="Une question, une idée, un problème ? Touchez « Écrire » en haut à droite : une personne de l'équipe vous répondra ici."
          />
        ) : (
          <div className="flex flex-col gap-2.5 p-4">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex flex-col gap-1", m.deLEquipe ? "items-start" : "items-end")}>
                {m.enReponseA ? (
                  <span className="flex max-w-[80%] items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-2xs font-medium text-accent-hover">
                    <Megaphone size={12} strokeWidth={2} aria-hidden />
                    <span className="truncate">En réponse à « {m.enReponseA} »</span>
                  </span>
                ) : null}
                <div
                  className={cn(
                    "flex max-w-[80%] flex-col gap-0.5 px-3 pt-2.5 pb-2",
                    m.deLEquipe ? "rounded-lg rounded-bl-xs border border-line bg-surface" : "rounded-lg rounded-br-xs bg-accent text-on-accent",
                  )}
                >
                  <p className="text-base leading-normal whitespace-pre-wrap">{m.texte}</p>
                  <time className={cn("self-end text-2xs", m.deLEquipe ? "text-ink-soft" : "text-on-accent/75")}>
                    {m.deLEquipe ? "Équipe Filloo · " : ""}
                    {formatMessageTime(m.quand)}
                  </time>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScreenBody>
    </Screen>
  );
}
