import Link from "next/link";
import { Bell, Megaphone, MessageCircleReply } from "lucide-react";
import { EnTeteEquipe } from "@/components/equipe/EnTeteEquipe";
import { gardeEquipe } from "@/components/equipe/garde";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen, ScreenBody } from "@/components/ui/Screen";
import { cn } from "@/lib/cn";
import { CHEMINS_EQUIPE, lireNotificationsEquipe, type NotificationEquipe } from "@/lib/data/equipe";
import type { Espace } from "@/lib/espace";
import { formatMessageTime } from "@/lib/format";

/**
 * « Équipe Filloo », onglet Notifications : tout ce que Filloo m'a envoyé
 * dans cet espace — les annonces et chaque « L'équipe vous a répondu » —,
 * le plus récent d'abord (décision du 2026-11-05). Les points disent ce
 * qui était non lu en arrivant ; l'ouvrir marque tout comme lu.
 */
export async function NotificationsEquipeScreen({ espace }: { espace: Espace }) {
  const { supabase, user } = await gardeEquipe(espace);

  const notifications = await lireNotificationsEquipe(supabase, user.id, espace);
  const nonLues = notifications.filter((n) => n.nonLue).length;
  await Promise.all([
    supabase.rpc("marquer_annonces_lues", { p_espace: espace }),
    supabase.rpc("marquer_fil_equipe_lu", { p_espace: espace }),
  ]);
  return <NotificationsEquipeVue espace={espace} notifications={notifications} nonLues={nonLues} />;
}

/** L'onglet, affichage seul : la page de test visuel le monte avec des données fictives. */
export function NotificationsEquipeVue({
  espace,
  notifications,
  nonLues,
}: {
  espace: Espace;
  notifications: NotificationEquipe[];
  nonLues: number;
}) {
  const chemin = CHEMINS_EQUIPE[espace];
  const retour = espace === "merchant" ? "/vendeur/boutique" : "/compte";
  return (
    <Screen largeur="rangees">
      <EnTeteEquipe espace={espace} onglet="notifications" backHref={retour} nonLus={nonLues} />
      <ScreenBody>
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Aucune notification"
            description="Les annonces de l'équipe Filloo et ses réponses à vos messages arriveront ici."
          />
        ) : (
          <ul className="flex flex-col">
            {notifications.map((n) => (
              <li key={`${n.type}-${n.id}`} className={cn("border-b border-line", n.nonLue ? "bg-accent-soft/50" : "bg-surface")}>
                {n.type === "annonce" ? (
                  <article className="flex gap-3 px-4 py-3.5">
                    <Icone nonLue={n.nonLue}>
                      <Megaphone size={18} strokeWidth={2} aria-hidden />
                    </Icone>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-2xs font-semibold text-accent-hover">Annonce</span>
                        <time className="shrink-0 text-2xs text-ink-soft">{formatMessageTime(n.quand)}</time>
                      </div>
                      <h2 className={cn("text-base", n.nonLue ? "font-bold" : "font-semibold")}>{n.titre}</h2>
                      <p className="text-sm whitespace-pre-wrap text-ink-soft">{n.texte}</p>
                      <Link
                        href={`${chemin}/ecrire?repondre=${n.id}`}
                        className="self-start pt-1 text-sm font-semibold text-accent underline-offset-2 hover:underline"
                      >
                        Répondre
                      </Link>
                    </div>
                  </article>
                ) : (
                  <Link href={`${chemin}/conversation`} className="flex gap-3 px-4 py-3.5">
                    <Icone nonLue={n.nonLue}>
                      <MessageCircleReply size={18} strokeWidth={2} aria-hidden />
                    </Icone>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn("text-base", n.nonLue ? "font-bold" : "font-semibold")}>
                          L&apos;équipe vous a répondu
                        </span>
                        <time className="shrink-0 text-2xs text-ink-soft">{formatMessageTime(n.quand)}</time>
                      </div>
                      <p className="truncate text-sm text-ink-soft">« {n.texte} »</p>
                    </div>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </ScreenBody>
    </Screen>
  );
}

/** L'icône d'une notification ; le point indique une notification non lue. */
function Icone({ nonLue, children }: { nonLue: boolean; children: React.ReactNode }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
      {children}
      {nonLue ? (
        <span aria-label="Non lue" className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-accent ring-2 ring-surface" />
      ) : null}
    </span>
  );
}
