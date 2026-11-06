import Link from "next/link";
import { ChevronRight, Megaphone, MessagesSquare, SquarePen } from "lucide-react";
import { gardeEquipe } from "@/components/equipe/garde";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenBody } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { cn } from "@/lib/cn";
import { CHEMINS_EQUIPE, lireNotificationsEquipe, type NotificationEquipe } from "@/lib/data/equipe";
import type { Espace } from "@/lib/espace";
import { formatMessageTime } from "@/lib/format";

/**
 * « Équipe Filloo » (décisions du 2026-11-05) : en haut, LA discussion
 * avec l'équipe — une seule par espace, tous les messages ensemble —,
 * puis les annonces, qui se lisent sans réponse. Le bouton « Écrire »
 * ouvre cette même discussion, champ prêt. Ouvrir la liste marque les
 * annonces comme lues ; la discussion se marque lue quand on l'ouvre.
 */
export async function EquipeScreen({ espace }: { espace: Espace }) {
  const { supabase, user } = await gardeEquipe(espace);
  const notifications = await lireNotificationsEquipe(supabase, user.id, espace);
  await supabase.rpc("marquer_annonces_lues", { p_espace: espace });
  return <EquipeVue espace={espace} notifications={notifications} />;
}

/** L'affichage seul : la page de test visuel le monte avec des données fictives. */
export function EquipeVue({ espace, notifications }: { espace: Espace; notifications: NotificationEquipe[] }) {
  const chemin = CHEMINS_EQUIPE[espace];
  const retour = espace === "merchant" ? "/vendeur/boutique" : "/compte";
  return (
    <Screen largeur="rangees">
      <TopBar
        title="Équipe Filloo"
        backHref={retour}
        right={
          <Link
            href={`${chemin}/discussion?ecrire=1`}
            className="-mr-1 flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-sm font-semibold text-on-accent"
          >
            <SquarePen size={16} strokeWidth={2.2} aria-hidden />
            Écrire
          </Link>
        }
      />
      <ScreenBody>
        {notifications.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Rien pour l'instant"
            description="Les annonces de l'équipe Filloo et votre discussion avec elle apparaîtront ici. Une question ? Touchez « Écrire » en haut à droite."
          />
        ) : (
          <ul className="flex flex-col">
            {notifications.map((n) => (
              <li
                key={n.type === "annonce" ? n.id : "discussion"}
                className={cn("border-b border-line", n.nonLue ? "bg-accent-soft/50" : "bg-surface")}
              >
                <Link
                  href={n.type === "annonce" ? `${chemin}/annonce/${n.id}` : `${chemin}/discussion`}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    {n.type === "annonce" ? (
                      <Megaphone size={18} strokeWidth={2} aria-hidden />
                    ) : (
                      <MessagesSquare size={18} strokeWidth={2} aria-hidden />
                    )}
                    {n.nonLue ? (
                      <span aria-label="Non lu" className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-accent ring-2 ring-surface" />
                    ) : null}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-base", n.nonLue ? "font-bold" : "font-semibold")}>
                        {n.type === "annonce" ? n.titre : "Discussion avec l'équipe"}
                      </span>
                      <time className="shrink-0 text-2xs text-ink-soft">{formatMessageTime(n.quand)}</time>
                    </div>
                    {n.type === "annonce" ? (
                      <span className="text-2xs font-semibold text-accent-hover">
                        Annonce{n.modifiee ? " · modifiée" : ""}
                      </span>
                    ) : n.deLEquipe ? (
                      <Badge tone="success">L&apos;équipe a répondu</Badge>
                    ) : (
                      <Badge tone="warn">En attente de réponse</Badge>
                    )}
                    <p className="line-clamp-2 text-sm text-ink-soft">
                      {n.type === "discussion" ? (n.deLEquipe ? "Équipe : " : "Vous : ") : ""}
                      {n.texte}
                    </p>
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
