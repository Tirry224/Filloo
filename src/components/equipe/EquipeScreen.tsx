import Link from "next/link";
import { ChevronRight, Megaphone, MessageCircleReply, SquarePen } from "lucide-react";
import { gardeEquipe } from "@/components/equipe/garde";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { Screen, ScreenBody } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { cn } from "@/lib/cn";
import { CHEMINS_EQUIPE, lireNotificationsEquipe, type NotificationEquipe } from "@/lib/data/equipe";
import type { Espace } from "@/lib/espace";
import { formatMessageTime } from "@/lib/format";

/**
 * « Équipe Filloo » (décision du 2026-11-05) : UNE liste — les annonces de
 * cet espace et les réponses de l'équipe, la plus récente d'abord — et le
 * bouton « Écrire » en haut à droite. Une annonce se LIT (on n'y répond
 * pas) ; une réponse s'ouvre avec la question et un champ pour répondre.
 * Les points disent ce qui était non lu en arrivant ; ouvrir la liste
 * marque tout comme lu.
 */
export async function EquipeScreen({
  espace,
  searchParams,
}: {
  espace: Espace;
  searchParams: Promise<{ envoye?: string }>;
}) {
  const { envoye } = await searchParams;
  const { supabase, user } = await gardeEquipe(espace);
  const notifications = await lireNotificationsEquipe(supabase, user.id, espace);
  await Promise.all([
    supabase.rpc("marquer_annonces_lues", { p_espace: espace }),
    supabase.rpc("marquer_fil_equipe_lu", { p_espace: espace }),
  ]);
  return <EquipeVue espace={espace} notifications={notifications} envoye={Boolean(envoye)} />;
}

/** L'affichage seul : la page de test visuel le monte avec des données fictives. */
export function EquipeVue({
  espace,
  notifications,
  envoye,
}: {
  espace: Espace;
  notifications: NotificationEquipe[];
  envoye: boolean;
}) {
  const chemin = CHEMINS_EQUIPE[espace];
  const retour = espace === "merchant" ? "/vendeur/boutique" : "/compte";
  return (
    <Screen largeur="rangees">
      <TopBar
        title="Équipe Filloo"
        /* Juste après un envoi, le retour repasse par la liste sans le
           bandeau, puis seulement par la page de compte (2026-11-05). */
        backHref={envoye ? chemin : retour}
        right={
          <Link
            href={`${chemin}/ecrire`}
            className="-mr-1 flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-semibold text-on-accent"
          >
            <SquarePen size={16} strokeWidth={2.2} aria-hidden />
            Écrire
          </Link>
        }
      />
      <ScreenBody>
        {envoye ? (
          <div className="px-4 pt-4">
            <Notice tone="success">Message envoyé. La réponse de l&apos;équipe apparaîtra ici.</Notice>
          </div>
        ) : null}
        {notifications.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Rien pour l'instant"
            description="Les annonces de l'équipe Filloo et ses réponses arriveront ici. Une question ? Touchez « Écrire » en haut à droite."
          />
        ) : (
          <ul className="flex flex-col">
            {notifications.map((n) => (
              <li key={`${n.type}-${n.id}`} className={cn("border-b border-line", n.nonLue ? "bg-accent-soft/50" : "bg-surface")}>
                <Link
                  href={n.type === "annonce" ? `${chemin}/annonce/${n.id}` : `${chemin}/reponse/${n.id}`}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    {n.type === "annonce" ? (
                      <Megaphone size={18} strokeWidth={2} aria-hidden />
                    ) : (
                      <MessageCircleReply size={18} strokeWidth={2} aria-hidden />
                    )}
                    {n.nonLue ? (
                      <span aria-label="Non lu" className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-accent ring-2 ring-surface" />
                    ) : null}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-base", n.nonLue ? "font-bold" : "font-semibold")}>
                        {n.type === "annonce" ? n.titre : "Réponse de l'équipe"}
                      </span>
                      <time className="shrink-0 text-2xs text-ink-soft">{formatMessageTime(n.quand)}</time>
                    </div>
                    <span className="text-2xs font-semibold text-accent-hover">{n.type === "annonce" ? "Annonce" : "À votre message"}</span>
                    <p className="line-clamp-2 text-sm text-ink-soft">{n.texte}</p>
                  </div>
                  <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-ink-soft" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ScreenBody>
    </Screen>
  );
}
